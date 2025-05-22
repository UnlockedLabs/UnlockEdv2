package models

import (
	"context"
	"math"
	"reflect"
)

type PaginatedResource[T any] struct {
	Message string         `json:"message"`
	Data    []T            `json:"data"`
	Meta    PaginationMeta `json:"meta,omitempty"`
}

type Resource[T any] struct {
	Message string `json:"message"`
	Data    T      `json:"data"`
}

func DefaultResource[T any](data T) Resource[T] {
	return Resource[T]{
		Message: "resource fetched successfully",
		Data:    data,
	}
}

type PaginationMeta struct {
	CurrentPage int   `json:"current_page"`
	LastPage    int   `json:"last_page"`
	PerPage     int   `json:"per_page"`
	Total       int64 `json:"total"`
}

func NewPaginationInfo(currentPage, perPage int, total int64) PaginationMeta {
	lastPage := int(total) / perPage
	if int(total)%perPage > 0 {
		lastPage++
	}
	return PaginationMeta{
		CurrentPage: currentPage,
		LastPage:    lastPage,
		PerPage:     perPage,
		Total:       total,
	}
}

func UpdateStruct(dst, src any) {
	srcVal := reflect.ValueOf(src).Elem()
	dstVal := reflect.ValueOf(dst).Elem()

	if srcVal.Kind() == reflect.Ptr {
		srcVal = srcVal.Elem()
	}

	if dstVal.Kind() == reflect.Ptr {
		dstVal = dstVal.Elem()
	}

	for i := 0; i < srcVal.NumField(); i++ {
		srcField := srcVal.Field(i)
		dstField := dstVal.Field(i)

		if !reflect.DeepEqual(srcField.Interface(), reflect.Zero(srcField.Type()).Interface()) {
			dstField.Set(srcField)
		}
	}
}

func StringPtr(s string) *string {
	return &s
}

type QueryContext struct {
	Page       int
	PerPage    int
	FacilityID uint
	UserID     uint
	OrderBy    string
	Order      string
	IsAdmin    bool
	Search     string
	Tags       []string
	Total      int64
	All        bool
	Ctx        context.Context
	Timezone   string
}

func (q QueryContext) IntoMeta() PaginationMeta {
	return NewPaginationInfo(q.Page, q.PerPage, q.Total)
}

func (q QueryContext) CalcOffset() int {
	return int(math.Abs(float64((q.Page - 1) * q.PerPage)))
}

// fallbackPrefix is the table name or alias used in the relevant query,
// which will be used with 'created_at' if there is no 'order_by' + 'order'
// present in the query string. Can be an empty string if there is only 1 table
// referenced in the query. Since created_at is usually present on every table,
// we have to prevent an ambiguous column error when using a join.
//
// Example: "select users.*, f.id from users join favorites f on f.user_id = users.id....."
// we would use:
//
//	tx.Order(args.OrderClause("f")).Find(&whatever)
//
// because we want it to fall-back to favorites.created_at
func (q QueryContext) OrderClause(fallbackPrefix string) string {
	val := q.OrderBy + " " + q.Order
	if val == " " {
		if fallbackPrefix != "" {
			fallbackPrefix += "."
		}
		return fallbackPrefix + "created_at desc"
	}
	return val
}

func (q QueryContext) SearchQuery() string {
	if q.Search == "" {
		return ""
	}
	return "%" + q.Search + "%"
}
