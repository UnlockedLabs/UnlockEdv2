package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"testing"

	"github.com/stretchr/testify/require"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{},
	}
}

type Request[T any] struct {
	t      *testing.T
	client *Client
	req    *http.Request
	asJson bool
}

type Response[T any] struct {
	t       *testing.T
	resp    *http.Response
	env     *envelope
	parsed  *T // the typed data from calling the api
	rawBody string
	decoded bool // protection from parsing the body multiple times
}

func NewRequest[T any](client *Client, t *testing.T, method, endpoint string, body any) *Request[T] {
	t.Helper()

	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err, "failed to marshal request body:")
		reader = bytes.NewBuffer(b)
	}

	fullURL, err := client.buildURL(endpoint)
	require.NoError(t, err, "invalid base url or endpoint")

	req, err := http.NewRequest(method, fullURL, reader)
	require.NoError(t, err, "failed to create http request")

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	return &Request[T]{t: t, client: client, req: req, asJson: true}
}

func (r *Request[T]) WithTestClaims(claims any) *Request[T] {
	r.t.Helper()
	b, err := json.Marshal(claims)
	require.NoError(r.t, err, "failed to marshal test claims")
	r.req.Header.Set("X-Test-Claims", string(b))
	r.req.Header.Set("test_claims", string(b))
	return r
}

func (r *Request[T]) WithHeader(key, value string) *Request[T] {
	r.t.Helper()
	r.req.Header.Set(key, value)
	return r
}

// instructs the client not to parse the response body into an object
func (r *Request[T]) AsRaw() *Request[T] {
	r.t.Helper()
	r.asJson = false
	return r
}

// call the api and parse the response
func (r *Request[T]) Do() *Response[T] {
	r.t.Helper()
	resp, err := r.client.httpClient.Do(r.req)
	require.NoError(r.t, err, "failed to execute http request")
	rawBytes, err := io.ReadAll(resp.Body)
	require.NoError(r.t, err, "failed to read response body")
	defer func() {
		if resp.Body.Close() != nil {
			r.t.Error("error closing response body")
		}
	}()

	var env envelope
	var parsed *T
	var decoded bool
	rawStr := string(rawBytes)

	if r.asJson && resp.StatusCode < 400 {
		require.NoError(r.t, json.Unmarshal(rawBytes, &env), "failed to unmarshal response body")

		parsed = new(T)
		if len(env.Data) > 0 {
			require.NoError(r.t, json.Unmarshal(env.Data, parsed), "failed to unmarshal response data")
			decoded = true
		}
	}

	return &Response[T]{
		t:       r.t,
		resp:    resp,
		env:     &env,
		parsed:  parsed,
		rawBody: rawStr,
		decoded: decoded,
	}
}

// asserts the expected status code is in the response
func (r *Response[T]) ExpectStatus(expected int) *Response[T] {
	r.t.Helper()

	if r.resp.StatusCode != expected {
		r.t.Fatalf("expected status %d, got %d", expected, r.resp.StatusCode)
	}
	return r
}

// asserts the expected message is in the response
func (r *Response[T]) ExpectMessage(expected string) *Response[T] {
	r.t.Helper()

	require.Equal(r.t, expected, r.env.Message, "expected message %s, got %s", expected, r.env.Message)
	return r
}

func (r *Response[T]) GetData() T {
	r.t.Helper()

	if !r.decoded {
		r.t.Fatalf("response body not decoded, envelope.Data=%s", string(r.env.Data))
	}
	return *r.parsed
}

type envelope struct {
	Data    json.RawMessage `json:"data"`
	Message string          `json:"message"`
}

// asserts the expected raw response body is in the response
func (r *Response[T]) ExpectRaw(expected string) {
	r.t.Helper()

	require.Equal(r.t, expected, r.rawBody)
}

func (c *Client) buildURL(endpoint string) (string, error) {
	u, err := url.Parse(c.baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid base URL: %w", err)
	}
	u.Path = path.Join(u.Path, endpoint)
	return u.String(), nil
}
