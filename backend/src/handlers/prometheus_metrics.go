package handlers

import (
	"net/http"

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
			Buckets: prometheus.DefBuckets,
		},
		[]string{"path", "method"},
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
)

func (srv *Server) prometheusMiddleware(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		timer := prometheus.NewTimer(requestDuration.WithLabelValues(r.URL.Path, r.Method))
		defer timer.ObserveDuration()

		requestSize.WithLabelValues(r.URL.Path).Observe(float64(r.ContentLength))
		rw := newResponseWriter(w)
		next.ServeHTTP(rw, r)

		responseSize.WithLabelValues(r.URL.Path).Observe(float64(rw.size))
	}
}
