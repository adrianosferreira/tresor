package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/tresor/tresor/internal/auth"
	"github.com/tresor/tresor/internal/middleware"
	"github.com/tresor/tresor/internal/models"
	"github.com/tresor/tresor/internal/vault"
)

type Handler struct {
	auth  *auth.Service
	vault *vault.Service
}

func New(authSvc *auth.Service, vaultSvc *vault.Service) *Handler {
	return &Handler{auth: authSvc, vault: vaultSvc}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email             string            `json:"email"`
		KdfSalt           string            `json:"kdfSalt"`
		KdfParams         models.KdfParams  `json:"kdfParams"`
		EncryptedVaultKey models.EncryptedBlob `json:"encryptedVaultKey"`
		AuthKeyHash       string            `json:"authKeyHash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	kdfSalt, err := auth.DecodeBase64(req.KdfSalt)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid kdfSalt")
		return
	}
	vaultKey, err := auth.DecodeBase64(req.EncryptedVaultKey.Ciphertext)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid encryptedVaultKey")
		return
	}
	vaultNonce, err := auth.DecodeBase64(req.EncryptedVaultKey.Nonce)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vault key nonce")
		return
	}
	authKeyHash, err := auth.DecodeBase64(req.AuthKeyHash)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid authKeyHash")
		return
	}

	resp, err := h.auth.Register(r.Context(), auth.RegisterInput{
		Email:             req.Email,
		KdfSalt:           kdfSalt,
		KdfParams:         req.KdfParams,
		EncryptedVaultKey: vaultKey,
		VaultKeyNonce:     vaultNonce,
		AuthKeyHash:       authKeyHash,
	})
	if errors.Is(err, auth.ErrEmailTaken) {
		writeError(w, http.StatusConflict, "email already registered")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "registration failed")
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) Lookup(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	resp, err := h.auth.Lookup(r.Context(), email)
	if errors.Is(err, auth.ErrInvalidCredentials) {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "lookup failed")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email        string `json:"email"`
		AuthKeyProof string `json:"authKeyProof"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	proof, err := auth.DecodeBase64(req.AuthKeyProof)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid authKeyProof")
		return
	}

	resp, err := h.auth.Login(r.Context(), req.Email, proof)
	if errors.Is(err, auth.ErrInvalidCredentials) {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projects, err := h.vault.ListProjects(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list projects")
		return
	}
	if projects == nil {
		projects = []models.Project{}
	}
	writeJSON(w, http.StatusOK, projects)
}

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	var req struct {
		NameEncrypted models.EncryptedBlob `json:"nameEncrypted"`
		SortOrder     int                  `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	project, err := h.vault.CreateProject(r.Context(), userID, req.NameEncrypted, req.SortOrder)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create project")
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	if err := h.vault.DeleteProject(r.Context(), userID, projectID); err != nil {
		if errors.Is(err, vault.ErrNotFound) {
			writeError(w, http.StatusNotFound, "project not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete project")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	categories, err := h.vault.ListCategories(r.Context(), userID, projectID)
	if err != nil {
		if errors.Is(err, vault.ErrNotFound) || errors.Is(err, vault.ErrForbidden) {
			writeError(w, http.StatusNotFound, "project not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to list categories")
		return
	}
	if categories == nil {
		categories = []models.Category{}
	}
	writeJSON(w, http.StatusOK, categories)
}

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var req struct {
		NameEncrypted models.EncryptedBlob `json:"nameEncrypted"`
		SortOrder     int                  `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	category, err := h.vault.CreateCategory(r.Context(), userID, projectID, req.NameEncrypted, req.SortOrder)
	if err != nil {
		if errors.Is(err, vault.ErrNotFound) || errors.Is(err, vault.ErrForbidden) {
			writeError(w, http.StatusNotFound, "project not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create category")
		return
	}
	writeJSON(w, http.StatusCreated, category)
}

func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	categoryID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid category id")
		return
	}

	if err := h.vault.DeleteCategory(r.Context(), userID, categoryID); err != nil {
		if errors.Is(err, vault.ErrNotFound) || errors.Is(err, vault.ErrForbidden) {
			writeError(w, http.StatusNotFound, "category not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete category")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListSecrets(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	categoryID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid category id")
		return
	}

	secrets, err := h.vault.ListSecrets(r.Context(), userID, categoryID)
	if err != nil {
		if errors.Is(err, vault.ErrNotFound) || errors.Is(err, vault.ErrForbidden) {
			writeError(w, http.StatusNotFound, "category not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to list secrets")
		return
	}
	if secrets == nil {
		secrets = []models.Secret{}
	}
	writeJSON(w, http.StatusOK, secrets)
}

func (h *Handler) CreateSecret(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	categoryID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid category id")
		return
	}

	var req struct {
		TitleEncrypted   models.EncryptedBlob `json:"titleEncrypted"`
		PayloadEncrypted models.EncryptedBlob `json:"payloadEncrypted"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	secret, err := h.vault.CreateSecret(r.Context(), userID, categoryID, req.TitleEncrypted, req.PayloadEncrypted)
	if err != nil {
		if errors.Is(err, vault.ErrNotFound) || errors.Is(err, vault.ErrForbidden) {
			writeError(w, http.StatusNotFound, "category not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create secret")
		return
	}
	writeJSON(w, http.StatusCreated, secret)
}

func (h *Handler) UpdateSecret(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	secretID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid secret id")
		return
	}

	var req struct {
		TitleEncrypted   *models.EncryptedBlob `json:"titleEncrypted"`
		PayloadEncrypted *models.EncryptedBlob `json:"payloadEncrypted"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	secret, err := h.vault.UpdateSecret(r.Context(), userID, secretID, req.TitleEncrypted, req.PayloadEncrypted)
	if err != nil {
		if errors.Is(err, vault.ErrNotFound) || errors.Is(err, vault.ErrForbidden) {
			writeError(w, http.StatusNotFound, "secret not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update secret")
		return
	}
	writeJSON(w, http.StatusOK, secret)
}

func (h *Handler) DeleteSecret(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	secretID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid secret id")
		return
	}

	if err := h.vault.DeleteSecret(r.Context(), userID, secretID); err != nil {
		if errors.Is(err, vault.ErrNotFound) || errors.Is(err, vault.ErrForbidden) {
			writeError(w, http.StatusNotFound, "secret not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete secret")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
