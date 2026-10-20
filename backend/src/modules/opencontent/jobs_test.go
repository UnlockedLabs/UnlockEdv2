package opencontent

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// provider-middleware reads these messages, so their subjects and bodies
// can't change.
func TestJobMessages(t *testing.T) {
	t.Run("add videos", func(t *testing.T) {
		provider := &OpenContentProvider{DatabaseFields: DatabaseFields{ID: 2}}
		msg, err := addVideosMsg([]string{"https://www.youtube.com/watch?v=a"}, provider)
		require.NoError(t, err)
		assert.Equal(t, "tasks.add_videos", msg.Subject)
		assert.JSONEq(t, `{"open_content_provider_id":2,"job_type":"add_videos","video_urls":["https://www.youtube.com/watch?v=a"]}`, string(msg.Data))
	})

	t.Run("retry a download", func(t *testing.T) {
		video := &Video{DatabaseFields: DatabaseFields{ID: 7}, OpenContentProviderID: 2}
		msg, err := retryManualDownloadMsg(video)
		require.NoError(t, err)
		assert.Equal(t, "tasks.retry_manual_download", msg.Subject)
		assert.JSONEq(t, `{"video_id":7,"open_content_provider_id":2,"job_type":"retry_video_downloads"}`, string(msg.Data))
	})
}
