package integration

import (
	"UnlockEdv2/src/config"
	"UnlockEdv2/src/handlers"
	"context"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

// setTestEnv sets an environment variable with fail-fast error handling
func setTestEnv(t *testing.T, key, value string) {
	t.Helper()
	if err := os.Setenv(key, value); err != nil {
		t.Fatalf("Failed to set %s: %v", key, err)
	}
}

// unsetTestEnv unsets an environment variable with fail-fast error handling
func unsetTestEnv(t *testing.T, key string) {
	t.Helper()
	if err := os.Unsetenv(key); err != nil {
		t.Fatalf("Failed to unset %s: %v", key, err)
	}
}

// restoreTestEnv restores multiple environment variables from a map
func restoreTestEnv(t *testing.T, originalValues map[string]string) {
	t.Helper()
	for varName, value := range originalValues {
		if value != "" {
			setTestEnv(t, varName, value)
		} else {
			unsetTestEnv(t, varName)
		}
	}
}

func TestServerFailsFastWithMissingDBHost(t *testing.T) {
	// Save original value
	originalValue := os.Getenv("DB_HOST")
	defer setTestEnv(t, "DB_HOST", originalValue)

	// Clear required env var
	unsetTestEnv(t, "DB_HOST")

	// Test that LoadConfig fails with clear error message
	cfg, err := config.LoadBackendConfig()
	assert.Error(t, err)
	assert.Nil(t, cfg)
	assert.Contains(t, err.Error(), "DB_HOST is required but not set")
}

func TestServerFailsFastWithMissingAppURL(t *testing.T) {
	// Save original values
	prereqVars := []string{"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "APP_KEY"}
	originalValues := make(map[string]string)
	for _, varName := range prereqVars {
		originalValues[varName] = os.Getenv(varName)
	}

	// Restore after test
	defer restoreTestEnv(t, originalValues)

	// Save original APP_URL and clear it
	originalValue := os.Getenv("APP_URL")
	defer setTestEnv(t, "APP_URL", originalValue)

	// Set prerequisite required variables
	setTestEnv(t, "DB_HOST", "localhost")
	setTestEnv(t, "DB_PORT", "5432")
	setTestEnv(t, "DB_USER", "test")
	setTestEnv(t, "DB_PASSWORD", "test")
	setTestEnv(t, "DB_NAME", "test")
	setTestEnv(t, "APP_KEY", "test-key")

	// Clear required env var
	unsetTestEnv(t, "APP_URL")

	// Test that LoadConfig fails with clear error message
	cfg, err := config.LoadBackendConfig()
	assert.Error(t, err)
	assert.Nil(t, cfg)
	assert.Contains(t, err.Error(), "APP_URL is required but not set")
}

func TestServerFailsFastWithMissingOryToken(t *testing.T) {
	// Save original values
	prereqVars := []string{"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "APP_KEY", "APP_URL", "HYDRA_ADMIN_URL", "HYDRA_PUBLIC_URL", "KRATOS_ADMIN_URL", "KRATOS_PUBLIC_URL", "NATS_URL", "NATS_USER", "NATS_PASSWORD", "PROVIDER_SERVICE_URL"}
	originalValues := make(map[string]string)
	for _, varName := range prereqVars {
		originalValues[varName] = os.Getenv(varName)
	}

	// Restore after test
	defer restoreTestEnv(t, originalValues)

	// Save original ORY_TOKEN and clear it
	originalValue := os.Getenv("ORY_TOKEN")
	defer setTestEnv(t, "ORY_TOKEN", originalValue)

	// Set all prerequisite required variables
	setTestEnv(t, "DB_HOST", "localhost")
	setTestEnv(t, "DB_PORT", "5432")
	setTestEnv(t, "DB_USER", "test")
	setTestEnv(t, "DB_PASSWORD", "test")
	setTestEnv(t, "DB_NAME", "test")
	setTestEnv(t, "APP_KEY", "test-key")
	setTestEnv(t, "APP_URL", "http://localhost:8080")
	setTestEnv(t, "HYDRA_ADMIN_URL", "http://localhost:4445")
	setTestEnv(t, "HYDRA_PUBLIC_URL", "http://localhost:4444")
	setTestEnv(t, "KRATOS_ADMIN_URL", "http://localhost:4434")
	setTestEnv(t, "KRATOS_PUBLIC_URL", "http://localhost:4433")
	setTestEnv(t, "NATS_URL", "nats://localhost:4222")
	setTestEnv(t, "NATS_USER", "test")
	setTestEnv(t, "NATS_PASSWORD", "test")
	setTestEnv(t, "PROVIDER_SERVICE_URL", "http://localhost:8081")

	// Clear required env var
	unsetTestEnv(t, "ORY_TOKEN")

	// Test that LoadConfig fails with clear error message
	cfg, err := config.LoadBackendConfig()
	assert.Error(t, err)
	assert.Nil(t, cfg)
	assert.Contains(t, err.Error(), "ORY_TOKEN is required but not set")
}

func TestServerStartsWithValidConfiguration(t *testing.T) {
	// Save original values
	requiredVars := []string{
		"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME",
		"APP_URL", "APP_KEY", "HYDRA_ADMIN_URL", "HYDRA_PUBLIC_URL",
		"KRATOS_ADMIN_URL", "KRATOS_PUBLIC_URL", "ORY_TOKEN",
		"NATS_URL", "NATS_USER", "NATS_PASSWORD", "PROVIDER_SERVICE_URL", "IMG_FILEPATH",
		"TO_EMAIL", "FROM_EMAIL",
	}

	originalValues := make(map[string]string)
	for _, varName := range requiredVars {
		originalValues[varName] = os.Getenv(varName)
	}

	// Restore after test
	defer restoreTestEnv(t, originalValues)

	// Set minimal required environment variables
	setTestEnv(t, "DB_HOST", "localhost")
	setTestEnv(t, "DB_PORT", "5432")
	setTestEnv(t, "DB_USER", "test")
	setTestEnv(t, "DB_PASSWORD", "test")
	setTestEnv(t, "DB_NAME", "test")
	setTestEnv(t, "APP_URL", "http://localhost:8080")
	setTestEnv(t, "APP_KEY", "test-key")
	setTestEnv(t, "HYDRA_ADMIN_URL", "http://localhost:4445")
	setTestEnv(t, "HYDRA_PUBLIC_URL", "http://localhost:4444")
	setTestEnv(t, "KRATOS_ADMIN_URL", "http://localhost:4434")
	setTestEnv(t, "KRATOS_PUBLIC_URL", "http://localhost:4433")
	setTestEnv(t, "ORY_TOKEN", "test-token")
	setTestEnv(t, "NATS_URL", "nats://localhost:4222")
	setTestEnv(t, "NATS_USER", "test")
	setTestEnv(t, "NATS_PASSWORD", "test")
	setTestEnv(t, "PROVIDER_SERVICE_URL", "http://localhost:8081")
	setTestEnv(t, "IMG_FILEPATH", "/imgs")
	setTestEnv(t, "TO_EMAIL", "test@example.com")
	setTestEnv(t, "FROM_EMAIL", "noreply@example.com")

	// Test that LoadConfig succeeds
	cfg, err := config.LoadBackendConfig()
	assert.NoError(t, err)
	assert.NotNil(t, cfg)

	// Verify values are properly loaded
	assert.Equal(t, "localhost", cfg.DBHost)
	assert.Equal(t, "5432", cfg.DBPort)
	assert.Equal(t, "test", cfg.DBUser)
	assert.Equal(t, "http://localhost:8080", cfg.AppURL)
	assert.Equal(t, "test-token", cfg.OryToken)
}

func TestConfigurationDefaults(t *testing.T) {
	// Save original values
	optionalVars := []string{"APP_ENV", "APP_PORT", "LOG_LEVEL", "MIGRATION_DIR"}

	originalValues := make(map[string]string)
	for _, varName := range optionalVars {
		originalValues[varName] = os.Getenv(varName)
	}

	// Restore after test
	defer restoreTestEnv(t, originalValues)

	// Clear optional variables
	for _, varName := range optionalVars {
		unsetTestEnv(t, varName)
	}

	// Set minimal required variables to pass validation
	setMinimalRequiredVars(t)

	// Test that LoadConfig applies defaults
	cfg, err := config.LoadBackendConfig()
	assert.NoError(t, err)
	assert.NotNil(t, cfg)

	// Verify defaults are applied
	assert.Equal(t, "dev", cfg.AppEnv)
	assert.Equal(t, "8080", cfg.AppPort)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, "backend/migrations", cfg.MigrationDir)
}

func TestConfigFieldAccessInHandlers(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	// Test that handlers work correctly with configuration (basic functionality check)
	t.Run("handler functionality works", func(t *testing.T) {
		// Test that health check endpoint works
		NewRequest[string](env.Client, t, http.MethodGet, "/api/healthcheck", nil).
			AsRaw().
			Do().
			ExpectStatus(http.StatusOK)
	})
}

func TestIntegrationTestIsolation(t *testing.T) {
	// Test that integration tests work with NewServer(true, ctx, nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// This should create a testing server without requiring real environment variables
	server := handlers.NewServer(true, ctx, nil)
	assert.NotNil(t, server)
	assert.True(t, server.IsTestingMode())

	// Verify that testing server doesn't panic even without config
	// This confirms that the testing isolation pattern still works
}

func setMinimalRequiredVars(t *testing.T) {
	// Set minimal required environment variables for testing
	setTestEnv(t, "DB_HOST", "localhost")
	setTestEnv(t, "DB_PORT", "5432")
	setTestEnv(t, "DB_USER", "test")
	setTestEnv(t, "DB_PASSWORD", "test")
	setTestEnv(t, "DB_NAME", "test")
	setTestEnv(t, "APP_URL", "http://localhost:8080")
	setTestEnv(t, "APP_KEY", "test-key")
	setTestEnv(t, "HYDRA_ADMIN_URL", "http://localhost:4445")
	setTestEnv(t, "HYDRA_PUBLIC_URL", "http://localhost:4444")
	setTestEnv(t, "KRATOS_ADMIN_URL", "http://localhost:4434")
	setTestEnv(t, "KRATOS_PUBLIC_URL", "http://localhost:4433")
	setTestEnv(t, "ORY_TOKEN", "test-token")
	setTestEnv(t, "NATS_URL", "nats://localhost:4222")
	setTestEnv(t, "NATS_USER", "test")
	setTestEnv(t, "NATS_PASSWORD", "test")
	setTestEnv(t, "PROVIDER_SERVICE_URL", "http://localhost:8081")
	setTestEnv(t, "IMG_FILEPATH", "/imgs")
	setTestEnv(t, "TO_EMAIL", "test@example.com")
	setTestEnv(t, "FROM_EMAIL", "noreply@example.com")
}
