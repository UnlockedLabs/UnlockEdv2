package src

import _ "embed"

//this file will be used to load static images used by the backend, particularly logos (used by report generator)

//go:embed assets/ul-symbol-k.png
var UnlockedLogoImg []byte
