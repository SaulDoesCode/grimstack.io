package grimstack

import (
	"time"
	//"fmt"
	//"github.com/tidwall/gjson"
	"errors"
	"github.com/Machiel/slugify"
	"encoding/json"
)

type StringMap = map[string]string

// Writ - struct representing a blog writ
type Writ struct {
	Key         string
	Title       string
	Author      string
	Content     string
	Markdown    string
	Description string
	Slug        string
	Tags        []string
	Edits       []time.Time
	Date        time.Time
	ViewCount   int64
	LikeCount   int64
	Published   bool
}

func (writ *Writ) Slugify() {
	writ.Slug = slugify.Slugify(writ.Title)
}

func writMapToWrit(writmap obj) Writ {
	return Writ{
		Key: writmap["_key"].(string),
		Title: writmap["title"].(string),
		Author: writmap["author"].(string),
		Content: writmap["content"].(string),
		Markdown: writmap["markdown"].(string),
		Description: writmap["description"].(string),
		Published: writmap["published"].(bool),
		Slug: writmap["slug"].(string),
		Tags: writmap["tags"].([]string),
		Edits: writmap["edits"].([]time.Time),
		Date: writmap["date"].(time.Time),
		ViewCount: writmap["viewcount"].(int64),
		LikeCount: writmap["likecount"].(int64),
	}
}

func GetWrit(title string, writType string) (Writ, bool) {
	var writ Writ
	data, err := runQuery(`
		FOR writ IN `+writType+`
		FILTER writ.title == @title
		RETURN writ
	`, obj{
		"title": title,
	})

	if err != nil || len(data) < 1 {
		return writ, false
	}

	writ = writMapToWrit(data[0])
	return writ, true
}

func GetWritDescBySlug(slug string, writType string) ([]byte, error) {
	var writJSON []byte
	data, err := runQuery(`
		FOR writ IN `+writType+`
		FILTER writ.published == true && writ.slug == @slug
		LIMIT 1
		UPDATE writ WITH { viewCount: writ.viewCount + 1 } IN `+writType+`
		RETURN UNSET(writ, "_id", "_rev", "edits", "content", "likes", "published", "markdown")
	`, obj{
		"slug": slug,
	})
	if err != nil || len(data) < 1 {
		if err == nil {
			return writJSON, errors.New(`404 - no such writ`)
		}
		return writJSON, err
	}
	writJSON, err = json.Marshal(data[0])
	return writJSON, err
}

func GetWritBySlug(slug string, writType string, shouldUpdateViewCount bool) ([]byte, error) {
	var writJSON []byte
	updateViewCount := ""
	if shouldUpdateViewCount {
		updateViewCount = `UPDATE writ WITH { viewCount: writ.viewCount + 1 } IN `+writType
	}

	data, err := runQuery(`
		FOR writ IN `+writType+`
		FILTER writ.published == true && writ.slug == @slug
		LIMIT 1
		`+updateViewCount+`
		RETURN UNSET(writ, "_id", "_rev", "edits", "description", "likes", "published", "markdown")
	`, obj{
		"slug": slug,
	})
	if err != nil || len(data) < 1 {
		if err == nil {
			return writJSON, errors.New(`404 - no such writ`)
		}
		return writJSON, err
	}
	writJSON, err = json.Marshal(data[0])
	return writJSON, err
}

func GetPersonalizedWritList(page int, username string, writType string) ([]byte, error) {
	var writJSON []byte
	data, err := runQuery(`
		FOR writ IN `+writType+`
		FILTER writ.published == true
		SORT writ.date DESC
		LIMIT @offset, 5
		LET doesLike = @username IN writ.likes
		RETURN MERGE(UNSET(writ, "_id", "_rev", "edits", "content", "published", "likes", "markdown"), {doesLike})
	`, obj{
		"offset": page,
		"username": username,
	})

	if err != nil || len(data) < 1 {
		if err == nil {
			return writJSON, errors.New(`404 - no such writ`)
		}
		return writJSON, err
	}
	writJSON, err = json.Marshal(data)
	return writJSON, err
}

func GetWritList(page int64, writType string) ([]byte, error) {
	var writJSON []byte
	data, err := runQuery(`
		FOR writ IN `+writType+`
		FILTER writ.published == true
		SORT writ.date DESC
		LIMIT @offset, 5
		RETURN UNSET(writ, "_id", "_rev", "edits", "content", "published", "likes", "markdown")
	`, obj{
		"offset": page,
	})

	if err != nil || len(data) < 1 {
		if err == nil {
			return writJSON, errors.New(`404 - no such writ`)
		}
		return writJSON, err
	}
	writJSON, err = json.Marshal(data)
	return writJSON, err
}

func GetFullWritList(page int64, writType string) ([]byte, error) {
	var writJSON []byte
	data, err := runQuery(`
		FOR writ IN `+writType+`
		FILTER writ.published == true
		SORT writ.date DESC
		LIMIT @offset, 5
		RETURN UNSET(writ, "_id", "_rev", "edits", "description", "published", "likes", "markdown")
	`, obj{
		"offset": page,
	})

	if err != nil || len(data) < 1 {
		if err == nil {
			return writJSON, errors.New(`404 - no such writ`)
		}
		return writJSON, err
	}
	writJSON, err = json.Marshal(data)
	return writJSON, err
}

func GetAllWrits(writType string) ([]byte, error) {
	var writJSON []byte
	data, err := runQuery(`
		FOR writ IN `+writType+`
		SORT writ.date DESC
		RETURN writ
	`, obj{})

	if err != nil || len(data) < 1 {
		if err == nil {
			return writJSON, errors.New(`404 - no such writ`)
		}
		return writJSON, err
	}
	writJSON, err = json.Marshal(data)
	return writJSON, err
}


func GetWritsByTag(tag string, page int64, writType string) ([]byte, error) {
	var writJSON []byte
	data, err := runQuery(`
		FOR writ IN `+writType+`
		FILTER writ.published == true && @tag IN writ.tags
		SORT writ.date DESC
		LIMIT @offset, 5
		RETURN UNSET(writ, "_id", "_rev", "edits", "content", "published", "likes", "markdown")
	`, obj{
		"offset": page,
		"tag": tag,
	})

	if err != nil || len(data) < 1 {
		if err == nil {
			return writJSON, errors.New(`404 - no such writ`)
		}
		return writJSON, err
	}
	writJSON, err = json.Marshal(data)
	return writJSON, err
}

func GetPersonalizedWritsByTag(tag string, page int, username string, writType string) ([]byte, error) {
	var writJSON []byte
	data, err := runQuery(`
		FOR writ IN `+writType+`
		FILTER writ.published == true && @tag IN writ.tags
		SORT writ.date DESC
		LIMIT @offset, 5
		LET doesLike = @username IN writ.likes
		RETURN MERGE(UNSET(writ, "_id", "_rev", "edits", "content", "published", "likes", "markdown"), {doesLike})
	`, obj{
		"offset": page,
		"username": username,
		"tag": tag,
	})

	if err != nil || len(data) < 1 {
		if err == nil {
			return writJSON, errors.New(`404 - no such writ`)
		}
		return writJSON, err
	}
	writJSON, err = json.Marshal(data)
	return writJSON, err
}
