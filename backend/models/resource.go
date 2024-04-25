package models

type PaginatedResource[T any] struct {
	Data []T            `json:"data"`
	Meta PaginationMeta `json:"meta"`
}

type Resource[T any] struct {
	Data []T `json:"data"`
}

type PaginationMeta struct {
	CurrentPage int   `json:"current_page"`
	LastPage    int   `json:"last_page"`
	PerPage     int   `json:"per_page"`
	Total       int64 `json:"total"`
}
