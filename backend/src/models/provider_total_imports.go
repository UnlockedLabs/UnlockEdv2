package models

type ProviderTotalImports struct {
	ID                 uint `gorm:"primary_key" json:"id"`
	ProviderPlatformID uint `gorm:"not null" json:"provider_platform_id"`
}

func (p ProviderTotalImports) TableName() string {
	return "provider_total_imports"
}
