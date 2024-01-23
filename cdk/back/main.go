package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"

	"encoding/json"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

var isError = false

func main() {
	e := echo.New()
	taskId, _ := getTaskIdFromMetadata()

	logger := zerolog.New(os.Stdout).With().Str("task_id", taskId).Bool("isError", isError).Logger()
	version := "v1"

	e.GET("/", func(c echo.Context) error {
		logger.Info().Msg("Request")

		if isError {
			return c.String(http.StatusInternalServerError, "backend error "+taskId+" "+version)
		} else {
			return c.String(http.StatusOK, "backend "+taskId+" "+version)
		}
	})

	e.GET("/error", func(c echo.Context) error {
		logger.Info().Msg("change isError flag")
		isError = !isError
		return c.String(http.StatusOK, fmt.Sprintf("isError is now %v", isError))
	})

	e.Debug = true

	go func() {
		if err := e.Start(":1235"); err != nil && err != http.ErrServerClosed {
			e.Logger.Fatal("shutting down the server")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, os.Interrupt)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		e.Logger.Fatal(err)
	}
}

func getTaskIdFromMetadata() (string, error) {
	metadataUri := os.Getenv("ECS_CONTAINER_METADATA_URI")

	if !isEmpty(metadataUri) {
		resp, err := http.Get(metadataUri + "/task")

		if err != nil {
			return "", err
		}

		body, err := ioutil.ReadAll(resp.Body)

		if err != nil {
			return "", err
		}

		var metadata map[string]interface{}
		json.Unmarshal([]byte(body), &metadata)
		taskArn := metadata["TaskARN"].(string)
		taskId := taskArn[strings.LastIndex(taskArn, "/")+1:]

		return taskId, nil
	}

	return "no task id 6", nil
}

func isEmpty(value string) bool {
	return len(value) <= 0
}
