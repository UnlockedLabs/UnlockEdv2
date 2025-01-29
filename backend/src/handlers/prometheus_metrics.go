package handlers

import (
	"net/http"
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode int
	size       int
}

func (rw *responseWriter) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
	rw.ResponseWriter.WriteHeader(statusCode)
}

func (rw *responseWriter) Write(data []byte) (int, error) {
	if rw.statusCode == 0 {
		rw.statusCode = http.StatusOK
	}
	bytesWritten, err := rw.ResponseWriter.Write(data)
	rw.size += bytesWritten
	return bytesWritten, err
}

func (rw *responseWriter) StatusCode() int {
	return rw.statusCode
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, statusCode: http.StatusOK, size: 0}
}

var (
	requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Histogram of response latency (seconds) for handler.",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10},
		},
		[]string{"path"},
	)
	requestSize = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_size_bytes",
			Help:    "Histogram of request size (bytes).",
			Buckets: prometheus.ExponentialBuckets(100, 10, 5),
		},
		[]string{"path"},
	)
	responseSize = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_response_size_bytes",
			Help:    "Histogram of response size (bytes).",
			Buckets: prometheus.ExponentialBuckets(100, 10, 5),
		},
		[]string{"path"},
	)
	requestCount = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Number of HTTP requests processed",
		},
		[]string{"path"},
	)
	responseStatus = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_response_status_total",
			Help: "Count of HTTP responses by status code, method, and path",
		},
		[]string{"path", "method", "status_code"},
	)
	errorCount = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_errors_total",
			Help: "Number of HTTP errors",
		},
		[]string{"route", "method", "status_code"},
	)
)

func (srv *Server) prometheusMiddleware(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		timer := prometheus.NewTimer(requestDuration.WithLabelValues(r.URL.Path))
		defer timer.ObserveDuration()
		requestSize.WithLabelValues(r.URL.Path).Observe(float64(r.ContentLength))

		rw := newResponseWriter(w)
		next.ServeHTTP(rw, r)

		responseSize.WithLabelValues(r.URL.Path).Observe(float64(rw.size))
		requestCount.WithLabelValues(r.URL.Path).Inc()
		statusCode := strconv.Itoa(rw.statusCode)
		if rw.statusCode >= 400 {
			errorCount.WithLabelValues(r.URL.Path, r.Method, statusCode).Inc()
		}
		responseStatus.WithLabelValues(r.URL.Path, r.Method, statusCode).Inc()
	}
}
