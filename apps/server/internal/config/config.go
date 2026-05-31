package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Addr           string
	DatabaseURL    string
	JWTSecret      string
	CORSOrigin     string
	MigrationsPath string
}

func Load() (*Config, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	addr := envOrDefault("ADDR", ":8080")
	corsOrigin := envOrDefault("CORS_ORIGIN", "http://localhost:5173")
	migrationsPath := envOrDefault("MIGRATIONS_PATH", "migrations")

	return &Config{
		Addr:           addr,
		DatabaseURL:    dbURL,
		JWTSecret:      jwtSecret,
		CORSOrigin:     corsOrigin,
		MigrationsPath: migrationsPath,
	}, nil
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envIntOrDefault(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
