package tasks

import (
	"UnlockEdv2/src/models"
	"fmt"
	"time"

	"github.com/go-co-op/gocron/v2"
	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type Scheduler struct {
	gocron.Scheduler
	nats *nats.Conn
	db   *gorm.DB
}

func InitScheduling(dev bool, nats *nats.Conn, db *gorm.DB) *Scheduler {
	scheduler, err := gocron.NewScheduler()
	if err != nil {
		log.Fatalf("Failed to create scheduler: %v", err)
		return nil
	}
	runner := Scheduler{scheduler, nats, db}
	tasks, err := runner.generateTasks()
	if err != nil {
		log.Fatalf("failed to generate tasks: %v", err)
		return nil
	}
	hour := 1
	for _, task := range tasks {
		if task.Job == nil {
			log.Errorf("Task %v has no job", task.ID)
			continue
		}
		_, err := runner.NewJob(gocron.CronJob(getCronSchedule(&task, hour), false), gocron.NewTask(runner.runTask, &task))
		if err != nil {
			log.Errorf("Failed to create job: %v", err)
			continue
		}
		hour++
		if hour > 23 {
			hour = 1
		}
	}
	if dev {
		runner.scheduleDevLibraryScrape(tasks)
	} else {
		runner.execute()
	}
	runner.Start()
	return &runner
}

// provider-service starts after the server and won't be able to access NATS,
// so here we need to delay the scrape to avoid publishing before anyone is listening.
const devLibraryScrapeDelay = 60 * time.Second

func (s *Scheduler) scheduleDevLibraryScrape(tasks []models.RunnableTask) {
	for _, task := range tasks {
		if task.Job == nil || task.Job.Name != string(models.ScrapeKiwixJob) {
			continue
		}
		startAt := gocron.OneTimeJobStartDateTime(time.Now().Add(devLibraryScrapeDelay))
		if _, err := s.NewJob(gocron.OneTimeJob(startAt), gocron.NewTask(s.runTask, &task)); err != nil {
			log.Errorf("Failed to schedule dev library scrape: %v", err)
		}
	}
}

func (s *Scheduler) Stop() error {
	return s.StopJobs()
}

func (s *Scheduler) execute() {
	tasks, err := s.generateTasks()
	if err != nil {
		log.Errorf("failed to generate tasks: %v", err)
		return
	}
	log.Infof("Generated %v tasks", tasks)
	for _, task := range tasks {
		if task.Provider != nil && task.Provider.Type == models.Brightspace {
			continue
		}
		log.Infof("Running task: %v", task.Job.Name)
		s.runTask(&task)
	}
}

func getCronSchedule(task *models.RunnableTask, hour int) string {
	if task.Provider != nil && task.Provider.Type == models.Brightspace {
		return fmt.Sprintf("0 %d * * 4", hour)
	} else {
		return task.Job.Schedule
	}
}
