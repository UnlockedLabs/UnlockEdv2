package opencontent

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"testing"

	"github.com/UnlockedLabs/unlocked-contracts/jobs"

	"github.com/nats-io/nats.go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// The worker reads these messages. The routes' messages are the ones
// provider-middleware read before EN-196, so they haven't changed.
func TestJobMessages(t *testing.T) {
	t.Run("scheduled job", func(t *testing.T) {
		msg, err := scheduledJobMsg(jobs.ScrapeKiwix, 3)
		require.NoError(t, err)
		assert.Equal(t, "tasks.scrape_kiwix", msg.Subject)
		assert.JSONEq(t, `{"open_content_provider_id":3,"job_type":"scrape_kiwix"}`, string(msg.Data))
	})

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

// fakeScheduler records what a module schedules.
type fakeScheduler struct {
	cron    map[string][]func()
	atStart []func()
}

// Cron rejects an empty spec, as the real scheduler does.
func (s *fakeScheduler) Cron(spec string, task func()) error {
	if spec == "" {
		return errors.New("empty cron spec")
	}
	s.cron[spec] = append(s.cron[spec], task)
	return nil
}

func (s *fakeScheduler) AtStart(task func()) error {
	s.atStart = append(s.atStart, task)
	return nil
}

// published records the subjects a jobPublisher publishes.
type published struct{ subjects []string }

func (p *published) publish(msg *nats.Msg) error {
	p.subjects = append(p.subjects, msg.Subject)
	return nil
}

func TestScheduleJobs(t *testing.T) {
	tests := []struct {
		name          string
		dev           bool
		retrySchedule string
		wantCron      map[string][]string
		wantAtStart   []string
	}{
		{
			name: "prod",
			wantCron: map[string][]string{
				"0 22 * * *":   {"tasks.scrape_kiwix", "tasks.sync_video_metadata"},
				"0 6-20 * * *": {"tasks.retry_video_downloads"},
			},
			wantAtStart: []string{"tasks.scrape_kiwix", "tasks.retry_video_downloads", "tasks.sync_video_metadata"},
		},
		{
			name: "dev runs only the scrape at start",
			dev:  true,
			wantCron: map[string][]string{
				"0 22 * * *":   {"tasks.scrape_kiwix", "tasks.sync_video_metadata"},
				"0 6-20 * * *": {"tasks.retry_video_downloads"},
			},
			wantAtStart: []string{"tasks.scrape_kiwix"},
		},
		{
			name:          "retry schedule from the env",
			retrySchedule: "*/5 * * * *",
			wantCron: map[string][]string{
				"0 22 * * *":  {"tasks.scrape_kiwix", "tasks.sync_video_metadata"},
				"*/5 * * * *": {"tasks.retry_video_downloads"},
			},
			wantAtStart: []string{"tasks.scrape_kiwix", "tasks.retry_video_downloads", "tasks.sync_video_metadata"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("MIDDLEWARE_CRON_SCHEDULE", "0 22 * * *")
			t.Setenv("RETRY_VIDEO_CRON_SCHEDULE", tt.retrySchedule)
			db := newTestDB(t)
			createProvider(t, db, Kiwix, true)
			createProvider(t, db, Youtube, true)
			pub := &published{}
			s := &fakeScheduler{cron: map[string][]func(){}}

			scheduleJobs(s, &jobPublisher{store: &store{db: db}, publish: pub.publish}, tt.dev)

			// Each scheduled task publishes its own job.
			run := func(tasks []func()) []string {
				pub.subjects = nil
				for _, task := range tasks {
					task()
				}
				return pub.subjects
			}
			gotCron := map[string][]string{}
			for spec, tasks := range s.cron {
				gotCron[spec] = run(tasks)
			}
			assert.Equal(t, tt.wantCron, gotCron)
			assert.Equal(t, tt.wantAtStart, run(s.atStart))
		})
	}
}

// A job whose schedule can't be set still runs once at start, as before
// EN-196.
func TestScheduleJobsBadSchedule(t *testing.T) {
	t.Setenv("MIDDLEWARE_CRON_SCHEDULE", "")
	t.Setenv("RETRY_VIDEO_CRON_SCHEDULE", "")
	db := newTestDB(t)
	createProvider(t, db, Kiwix, true)
	createProvider(t, db, Youtube, true)
	pub := &published{}
	s := &fakeScheduler{cron: map[string][]func(){}}

	scheduleJobs(s, &jobPublisher{store: &store{db: db}, publish: pub.publish}, false)

	assert.Equal(t, []string{"0 6-20 * * *"}, slices.Collect(maps.Keys(s.cron)))
	for _, task := range s.atStart {
		task()
	}
	assert.Equal(t, []string{"tasks.scrape_kiwix", "tasks.retry_video_downloads", "tasks.sync_video_metadata"}, pub.subjects)
}

func createProvider(t *testing.T, db *gorm.DB, title string, enabled bool) *OpenContentProvider {
	t.Helper()
	p := &OpenContentProvider{Title: &title, Url: "https://" + strings.ToLower(title) + ".example", CurrentlyEnabled: enabled}
	require.NoError(t, db.Create(p).Error)
	return p
}

func TestJobPublisherRun(t *testing.T) {
	db := newTestDB(t)
	createProvider(t, db, Youtube, false)
	kiwix := createProvider(t, db, Kiwix, true)
	var msgs []*nats.Msg
	p := &jobPublisher{store: &store{db: db}, publish: func(m *nats.Msg) error {
		msgs = append(msgs, m)
		return nil
	}}

	p.run(context.Background(), jobs.ScrapeKiwix)
	// YouTube is off, so its jobs publish nothing.
	p.run(context.Background(), jobs.RetryVideoDownloads)
	p.run(context.Background(), jobs.SyncVideoMetadata)

	require.Len(t, msgs, 1)
	assert.Equal(t, "tasks.scrape_kiwix", msgs[0].Subject)
	assert.JSONEq(t, fmt.Sprintf(`{"open_content_provider_id":%d,"job_type":"scrape_kiwix"}`, kiwix.ID), string(msgs[0].Data))
}
