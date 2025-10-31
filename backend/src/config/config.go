package config

import (
	"fmt"
	"os"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	AppDSN     string

	AppURL        string
	AppEnv        string
	AppPort       string
	LogLevel      string
	MigrationDir  string
	AppKey        string

	HydraAdminURL   string
	HydraPublicURL  string
	HydraAdminToken string
	KratosAdminURL  string
	KratosPublicURL string
	OryToken        string

	NATSURL      string
	NATSUser     string
	NATSPassword string

	AWSRegion          string
	S3BucketName       string
	AWSAccountID       string
	AWSAccessKeyID     string
	AWSSecretAccessKey string
	TOEmail            string
	FROMEmail          string
	ImgFilepath        string

	ProviderServiceURL string
	ProviderServiceKey string
	KolibriURL         string
	KolibriUsername    string
	KolibriPassword    string
	KolibriDBPassword  string
	KiwixServerURL     string

	MiddlewareCronSchedule string
	RetryVideoCronSchedule string
	BrightspaceTempDir     string
}

func LoadBackendConfig() (*Config, error) {
	cfg := &Config{}

	cfg.AppDSN = os.Getenv("APP_DSN")

	cfg.DBHost = os.Getenv("DB_HOST")
	if cfg.DBHost == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_HOST is required but not set (or provide APP_DSN)")
	}

	cfg.DBPort = os.Getenv("DB_PORT")
	if cfg.DBPort == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_PORT is required but not set (or provide APP_DSN)")
	}

	cfg.DBUser = os.Getenv("DB_USER")
	if cfg.DBUser == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_USER is required but not set (or provide APP_DSN)")
	}

	cfg.DBPassword = os.Getenv("DB_PASSWORD")
	if cfg.DBPassword == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_PASSWORD is required but not set (or provide APP_DSN)")
	}

	cfg.DBName = os.Getenv("DB_NAME")
	if cfg.DBName == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_NAME is required but not set (or provide APP_DSN)")
	}

	cfg.AppURL = os.Getenv("APP_URL")
	if cfg.AppURL == "" {
		return nil, fmt.Errorf("APP_URL is required but not set")
	}

	cfg.AppKey = os.Getenv("APP_KEY")
	if cfg.AppKey == "" {
		return nil, fmt.Errorf("APP_KEY is required but not set")
	}

	cfg.HydraAdminURL = os.Getenv("HYDRA_ADMIN_URL")
	if cfg.HydraAdminURL == "" {
		return nil, fmt.Errorf("HYDRA_ADMIN_URL is required but not set")
	}

	cfg.HydraPublicURL = os.Getenv("HYDRA_PUBLIC_URL")
	if cfg.HydraPublicURL == "" {
		return nil, fmt.Errorf("HYDRA_PUBLIC_URL is required but not set")
	}

	cfg.KratosAdminURL = os.Getenv("KRATOS_ADMIN_URL")
	if cfg.KratosAdminURL == "" {
		return nil, fmt.Errorf("KRATOS_ADMIN_URL is required but not set")
	}

	cfg.KratosPublicURL = os.Getenv("KRATOS_PUBLIC_URL")
	if cfg.KratosPublicURL == "" {
		return nil, fmt.Errorf("KRATOS_PUBLIC_URL is required but not set")
	}

	cfg.OryToken = os.Getenv("ORY_TOKEN")
	if cfg.OryToken == "" {
		return nil, fmt.Errorf("ORY_TOKEN is required but not set")
	}

	cfg.NATSURL = os.Getenv("NATS_URL")
	if cfg.NATSURL == "" {
		return nil, fmt.Errorf("NATS_URL is required but not set")
	}

	cfg.NATSUser = os.Getenv("NATS_USER")
	if cfg.NATSUser == "" {
		return nil, fmt.Errorf("NATS_USER is required but not set")
	}

	cfg.NATSPassword = os.Getenv("NATS_PASSWORD")
	if cfg.NATSPassword == "" {
		return nil, fmt.Errorf("NATS_PASSWORD is required but not set")
	}

	cfg.ProviderServiceURL = os.Getenv("PROVIDER_SERVICE_URL")
	if cfg.ProviderServiceURL == "" {
		return nil, fmt.Errorf("PROVIDER_SERVICE_URL is required but not set")
	}

	cfg.AppEnv = os.Getenv("APP_ENV")
	if cfg.AppEnv == "" {
		cfg.AppEnv = "dev"
	}

	cfg.AppPort = os.Getenv("APP_PORT")
	if cfg.AppPort == "" {
		cfg.AppPort = "8080"
	}

	cfg.LogLevel = os.Getenv("LOG_LEVEL")
	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}

	cfg.MigrationDir = os.Getenv("MIGRATION_DIR")
	if cfg.MigrationDir == "" {
		cfg.MigrationDir = "backend/migrations"
	}

	cfg.HydraAdminToken = os.Getenv("HYDRA_ADMIN_TOKEN")
	cfg.ProviderServiceKey = os.Getenv("PROVIDER_SERVICE_KEY")
	cfg.KolibriURL = os.Getenv("KOLIBRI_URL")
	cfg.KolibriUsername = os.Getenv("KOLIBRI_USERNAME")
	cfg.KolibriPassword = os.Getenv("KOLIBRI_PASSWORD")
	cfg.KolibriDBPassword = os.Getenv("KOLIBRI_DB_PASSWORD")
	cfg.KiwixServerURL = os.Getenv("KIWIX_SERVER_URL")
	cfg.MiddlewareCronSchedule = os.Getenv("MIDDLEWARE_CRON_SCHEDULE")
	cfg.RetryVideoCronSchedule = os.Getenv("RETRY_VIDEO_CRON_SCHEDULE")
	cfg.BrightspaceTempDir = os.Getenv("BRIGHTSPACE_TEMP_DIR")

	cfg.AWSRegion = os.Getenv("AWS_REGION")
	cfg.S3BucketName = os.Getenv("S3_BUCKET_NAME")
	cfg.AWSAccountID = os.Getenv("AWS_ACCOUNT_ID")
	cfg.AWSAccessKeyID = os.Getenv("AWS_ACCESS_KEY_ID")
	cfg.AWSSecretAccessKey = os.Getenv("AWS_SECRET_ACCESS_KEY")
	cfg.TOEmail = os.Getenv("TO_EMAIL")
	cfg.FROMEmail = os.Getenv("FROM_EMAIL")
	cfg.ImgFilepath = os.Getenv("IMG_FILEPATH")
	if cfg.ImgFilepath == "" {
		return nil, fmt.Errorf("IMG_FILEPATH is required but not set")
	}

	return cfg, nil
}

func LoadMiddlewareConfig() (*Config, error) {
	cfg := &Config{}

	cfg.AppDSN = os.Getenv("APP_DSN")

	cfg.DBHost = os.Getenv("DB_HOST")
	if cfg.DBHost == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_HOST is required but not set (or provide APP_DSN)")
	}

	cfg.DBPort = os.Getenv("DB_PORT")
	if cfg.DBPort == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_PORT is required but not set (or provide APP_DSN)")
	}

	cfg.DBUser = os.Getenv("DB_USER")
	if cfg.DBUser == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_USER is required but not set (or provide APP_DSN)")
	}

	cfg.DBPassword = os.Getenv("DB_PASSWORD")
	if cfg.DBPassword == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_PASSWORD is required but not set (or provide APP_DSN)")
	}

	cfg.DBName = os.Getenv("DB_NAME")
	if cfg.DBName == "" && cfg.AppDSN == "" {
		return nil, fmt.Errorf("DB_NAME is required but not set (or provide APP_DSN)")
	}

	cfg.AppKey = os.Getenv("APP_KEY")
	if cfg.AppKey == "" {
		return nil, fmt.Errorf("APP_KEY is required but not set")
	}

	cfg.NATSURL = os.Getenv("NATS_URL")
	if cfg.NATSURL == "" {
		return nil, fmt.Errorf("NATS_URL is required but not set")
	}

	cfg.NATSUser = os.Getenv("NATS_USER")
	if cfg.NATSUser == "" {
		return nil, fmt.Errorf("NATS_USER is required but not set")
	}

	cfg.NATSPassword = os.Getenv("NATS_PASSWORD")
	if cfg.NATSPassword == "" {
		return nil, fmt.Errorf("NATS_PASSWORD is required but not set")
	}

	cfg.ProviderServiceKey = os.Getenv("PROVIDER_SERVICE_KEY")
	if cfg.ProviderServiceKey == "" {
		return nil, fmt.Errorf("PROVIDER_SERVICE_KEY is required but not set")
	}

	cfg.KiwixServerURL = os.Getenv("KIWIX_SERVER_URL")

	cfg.ImgFilepath = os.Getenv("IMG_FILEPATH")

	// Optional with defaults
	cfg.AppEnv = os.Getenv("APP_ENV")
	if cfg.AppEnv == "" {
		cfg.AppEnv = "dev"
	}

	cfg.LogLevel = os.Getenv("LOG_LEVEL")
	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}

	return cfg, nil
}

// MustLoad panics on config error (use only in main)
func MustLoad() *Config {
	cfg, err := LoadBackendConfig()
	if err != nil {
		panic(err)
	}
	return cfg
}
