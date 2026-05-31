package server

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tresor/tresor/internal/auth"
	"github.com/tresor/tresor/internal/config"
	"github.com/tresor/tresor/internal/handlers"
	authmw "github.com/tresor/tresor/internal/middleware"
	"github.com/tresor/tresor/internal/vault"
)

type Server struct {
	cfg     *config.Config
	handler *handlers.Handler
	auth    *auth.Service
}

func New(cfg *config.Config, pool *pgxpool.Pool) *Server {
	authSvc := auth.NewService(pool, cfg.JWTSecret)
	vaultSvc := vault.NewService(pool)
	return &Server{
		cfg:     cfg,
		auth:    authSvc,
		handler: handlers.New(authSvc, vaultSvc),
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{s.cfg.CORSOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", s.handler.Health)

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/register", s.handler.Register)
		r.Get("/auth/lookup", s.handler.Lookup)
		r.Post("/auth/login", s.handler.Login)

		r.Group(func(r chi.Router) {
			r.Use(authmw.Auth(s.auth))
			r.Get("/projects", s.handler.ListProjects)
			r.Post("/projects", s.handler.CreateProject)
			r.Delete("/projects/{id}", s.handler.DeleteProject)
			r.Get("/projects/{id}/categories", s.handler.ListCategories)
			r.Post("/projects/{id}/categories", s.handler.CreateCategory)
			r.Get("/categories/{id}/secrets", s.handler.ListSecrets)
			r.Post("/categories/{id}/secrets", s.handler.CreateSecret)
			r.Patch("/secrets/{id}", s.handler.UpdateSecret)
			r.Delete("/secrets/{id}", s.handler.DeleteSecret)
		})
	})

	return r
}
