package tasks

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"slices"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
)

func (s *Scheduler) runTask(task *models.RunnableTask) {
	// publish the task to the nats server, update the satus of the task to 'running'
	task.Parameters["last_run"] = task.LastRun
	task.Parameters["job_id"] = task.JobID
	jobType := task.Parameters["job_type"].(string)
	params, err := json.Marshal(task.Parameters)
	if err != nil {
		log.Errorf("failed to marshal params: %v", err)
		return
	}
	task.Status = models.StatusRunning
	if err := s.db.Model(&models.RunnableTask{}).Where("id = ?", task.ID).Update("status", models.StatusRunning).Error; err != nil {
		log.Errorf("failed to update task status: %v", err)
		return
	}
	msg := nats.NewMsg(models.JobType(jobType).PubName())
	msg.Data = params
	if err := s.nats.PublishMsg(msg); err != nil {
		log.Errorf("failed to publish job: %v", err)
		return
	}
	log.Info("Published job: ", jobType)
}

func (s *Scheduler) generateTasks() ([]models.RunnableTask, error) {
	allTasks := make([]models.RunnableTask, 0, 10)
	if dailyProgramHistoryTasks, err := s.generateProgramHistoryTasks(); err == nil {
		allTasks = append(allTasks, dailyProgramHistoryTasks...)
	}
	if ocpTasks, err := s.generateOpenContentProviderTasks(); err == nil {
		allTasks = append(allTasks, ocpTasks...)
	} else {
		log.Println("Failed to generate open content provider tasks")
	}
	if providerTasks, err := s.generateProviderTasks(); err == nil {
		allTasks = append(allTasks, providerTasks...)
	} else {
		log.Println("Failed to generate provider tasks")
	}
	return allTasks, nil
}

func (s *Scheduler) generateProgramHistoryTasks() ([]models.RunnableTask, error) {
	tasksToRun := make([]models.RunnableTask, 0, 1)
	job, err := s.createIfNotExists(models.DailyProgHistoryJob)
	if err != nil {
		log.Errorf("failed to create job: %v", err)
		return nil, err
	}
	newTask := models.RunnableTask{JobID: job.ID, Status: models.StatusPending}
	err = s.intoTask(job, nil, &newTask)
	if err != nil {
		log.Errorf("failed to create task: %v", err)
		return nil, err
	}
	tasksToRun = append(tasksToRun, newTask)
	log.Infof("Generated %d total tasks", len(tasksToRun))
	return tasksToRun, nil
}

func (s *Scheduler) generateOpenContentProviderTasks() ([]models.RunnableTask, error) {
	otherTasks := make([]models.RunnableTask, 0, 5)
	providers := make([]models.OpenContentProvider, 0, 2)
	if err := s.db.Find(&providers, "currently_enabled = true").Error; err != nil {
		log.Errorf("failed to fetch all open content providers: %v", err)
		return nil, err
	}
	vidProvider := slices.IndexFunc(providers, func(p models.OpenContentProvider) bool {
		return p.Title == models.Youtube
	})
	libProvider := slices.IndexFunc(providers, func(p models.OpenContentProvider) bool {
		return p.Title == models.Kiwix
	})
	for _, jobType := range models.AllContentProviderJobs {
		if jobType.IsLibraryJob() {
			if libProvider == -1 {
				continue
			}
			job := models.CronJob{Name: string(jobType)}
			task, err := s.handleCreateOCProviderTask(&job, providers[libProvider].ID)
			if err != nil {
				log.Errorf("failed to create task: %v", err)
				continue
			}
			otherTasks = append(otherTasks, *task)
		} else if jobType.IsVideoJob() {
			if vidProvider == -1 {
				continue
			}
			job := models.CronJob{Name: string(jobType)}
			task, err := s.handleCreateOCProviderTask(&job, providers[vidProvider].ID)
			if err != nil {
				log.Errorf("failed to create task: %v", err)
				continue
			}
			otherTasks = append(otherTasks, *task)
		}
	}
	return otherTasks, nil
}

func (s *Scheduler) generateProviderTasks() ([]models.RunnableTask, error) {
	var providers []models.ProviderPlatform
	if err := s.db.Find(&providers, "state = 'enabled'").Error; err != nil {
		log.Errorln("failed to fetch all provider platforms")
		return nil, err
	}
	log.Infof("Found %d active providers", len(providers))
	tasksToRun := make([]models.RunnableTask, 0)
	for _, provider := range providers {
		provJobs := provider.GetDefaultCronJobs()
		for _, jobType := range provJobs {
			created, err := s.createIfNotExists(jobType)
			if err != nil {
				log.Errorf("failed to create job: %v", err)
				return nil, err
			}
			newTask := models.RunnableTask{JobID: created.ID, ProviderPlatformID: &provider.ID, Status: models.StatusPending}
			err = s.intoTask(created, &provider.ID, &newTask)
			if err != nil {
				log.Errorf("failed to create task: %v", err)
				return nil, err
			}
			tasksToRun = append(tasksToRun, newTask)
		}
	}
	log.Infof("Generated %d total tasks for %d providers", len(tasksToRun), len(providers))
	return tasksToRun, nil
}

func (s *Scheduler) intoTask(cj *models.CronJob, provId *uint, task *models.RunnableTask) error {
	if task.ID == 0 {
		tx := s.db.Model(&models.RunnableTask{}).Where("job_id = ?", cj.ID)
		switch cj.Category {
		case models.ProviderPlatformJob:
			tx = tx.Where("provider_platform_id = ?", provId)
		case models.OpenContentJob:
			tx = tx.Where("open_content_provider_id = ?", provId)
		}
		if err := tx.FirstOrCreate(&task).Error; err != nil {
			log.Errorf("failed to create task for job: %v. error: %v", cj.Name, err)
			return err
		}
		if err := s.db.Model(&models.RunnableTask{}).Preload("Job").Preload("Provider").First(&task, task.ID).Error; err != nil {
			log.Errorf("failed to reload task for job: %v. error: %v", cj.Name, err)
			return err
		}
	}
	task.Job = cj
	task.Prepare(provId)
	return nil
}

func (s *Scheduler) createIfNotExists(cj models.JobType) (*models.CronJob, error) {
	job := models.CronJob{Name: string(cj)}
	if err := s.db.Model(&models.CronJob{}).Where("name = ?", cj).FirstOrCreate(&job).Error; err != nil {
		log.Errorf("failed to find or create job: %v", err)
		return nil, err
	}
	log.Infof("CronJob %s has ID: %s", job.Name, job.ID)
	return &job, nil
}

func (s *Scheduler) handleCreateOCProviderTask(job *models.CronJob, providerId uint) (*models.RunnableTask, error) {
	if err := s.db.Model(&models.CronJob{}).Preload("Tasks").Where("name = ?", string(job.Name)).FirstOrCreate(&job).Error; err != nil {
		log.Errorf("failed to create job: %v", err)
		return nil, err
	}
	task := models.RunnableTask{}
	if len(job.Tasks) > 0 {
		log.Infof("Job %s already has a task with id: %d", job.Name, job.Tasks[0].ID)
		task = job.Tasks[0]
	} else {
		task = models.RunnableTask{OpenContentProviderID: &providerId, JobID: job.ID, Status: models.StatusPending}
	}
	if err := s.intoTask(job, &providerId, &task); err != nil {
		log.Errorf("failed to create task: %v", err)
		return nil, err
	}
	return &task, nil
}
