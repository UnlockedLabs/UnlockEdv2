package models

import "sync"

var (
	configMu        sync.RWMutex
	appKey          string
	kiwixLibraryURL string
)

// SetAppKey stores the APP_KEY for encryption helpers. Must be called during startup.
func SetAppKey(key string) {
	configMu.Lock()
	defer configMu.Unlock()
	appKey = key
}

func getAppKey() string {
	configMu.RLock()
	defer configMu.RUnlock()
	if appKey == "" {
		panic("models: app key not configured")
	}
	return appKey
}

func SetKiwixLibraryURL(url string) {
	kiwixLibraryURL = url
}

func KiwixLibraryURL() string {
	return kiwixLibraryURL
}
