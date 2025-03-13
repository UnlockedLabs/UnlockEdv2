package models

import (
	"context"
	"fmt"
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

func UpdateStruct(dst, src interface{}) {
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
}

func (q QueryContext) IntoMeta() PaginationMeta {
	return NewPaginationInfo(q.Page, q.PerPage, q.Total)
}

func (q QueryContext) CalcOffset() int {
	return (q.Page - 1) * q.PerPage
}

func (q QueryContext) OrderClause() string {
	return fmt.Sprintf("%s %s", q.OrderBy, q.Order)
}
