package db

import (
	"context"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}

	return pool, nil
}

func Migrate(ctx context.Context, pool *pgxpool.Pool, _ string) error {
	if err := applyMigrationIfNeeded(ctx, pool, "users", "migrations/001_initial.sql"); err != nil {
		return err
	}
	if err := applyMigrationIfNeeded(ctx, pool, "secrets.alias", "migrations/002_secret_aliases.sql"); err != nil {
		return err
	}
	return nil
}

func applyMigrationIfNeeded(ctx context.Context, pool *pgxpool.Pool, marker, path string) error {
	exists, err := migrationMarkerExists(ctx, pool, marker)
	if err != nil {
		return fmt.Errorf("check migration %s: %w", path, err)
	}
	if exists {
		return nil
	}

	sql, err := migrationFS.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read migration %s: %w", path, err)
	}

	if _, err := pool.Exec(ctx, string(sql)); err != nil {
		return fmt.Errorf("apply migration %s: %w", path, err)
	}

	return nil
}

func migrationMarkerExists(ctx context.Context, pool *pgxpool.Pool, marker string) (bool, error) {
	switch marker {
	case "users":
		var exists bool
		err := pool.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = 'users'
			)
		`).Scan(&exists)
		return exists, err
	case "secrets.alias":
		var exists bool
		err := pool.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'secrets'
				  AND column_name = 'alias'
			)
		`).Scan(&exists)
		return exists, err
	default:
		return false, fmt.Errorf("unknown migration marker: %s", marker)
	}
}
