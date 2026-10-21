package opencontent

import (
	"fmt"
	"testing"
	"time"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type sentMessage struct {
	userID uint
	msg    module.Message
}

type fakeNotifier struct{ sent []sentMessage }

func (n *fakeNotifier) Notify(userID uint, msg module.Message) {
	n.sent = append(n.sent, sentMessage{userID, msg})
}

// openTestDB is a new in-memory database with Open Content's tables, closed
// when the test ends.
func openTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:opencontent_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(Module{}.TestModels()...))
	return db
}

// A visit is recorded, and the user's tab is told about it so it can end the
// activity. A library page also says whether it is bookmarked.
func TestCreateContentActivityAndNotifyWS(t *testing.T) {
	db := openTestDB(t)
	notify := &fakeNotifier{}
	srv := &server{store: &store{db: db}, notify: notify}

	page := "/api/proxy/libraries/1/A/Lesson_1"
	visit := func(url string) int64 {
		activity := OpenContentActivity{OpenContentProviderID: 1, FacilityID: 2, UserID: 7, ContentID: 1, RequestTS: time.Now()}
		srv.createContentActivityAndNotifyWS(url, &activity)
		require.NotZero(t, activity.ID)
		return activity.ID
	}

	t.Run("library page, not bookmarked", func(t *testing.T) {
		notify.sent = nil
		id := visit(page)
		assert.Equal(t, []sentMessage{
			{7, module.Message{Event: "visits", ActivityID: id}},
			{7, module.Message{Event: "bookmarks", Text: "false"}},
		}, notify.sent)
	})

	t.Run("library page, bookmarked", func(t *testing.T) {
		var url OpenContentUrl
		require.NoError(t, db.First(&url, "content_url = ?", page).Error)
		require.NoError(t, db.Create(&OpenContentFavorite{UserID: 7, ContentID: 1, OpenContentProviderID: 1, OpenContentUrlID: &url.ID}).Error)

		notify.sent = nil
		id := visit(page)
		assert.Equal(t, []sentMessage{
			{7, module.Message{Event: "visits", ActivityID: id}},
			{7, module.Message{Event: "bookmarks", Text: "true"}},
		}, notify.sent)
	})

	t.Run("video", func(t *testing.T) {
		notify.sent = nil
		id := visit("/viewer/videos/1")
		assert.Equal(t, []sentMessage{{7, module.Message{Event: "visits", ActivityID: id}}}, notify.sent)
	})
}
