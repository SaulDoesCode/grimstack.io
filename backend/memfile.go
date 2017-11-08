package grimstack

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo"
)

// MemFile - in memory file struct
type MemFile struct {
	ContentType    string
	ETag           string
	DefaultContent []byte
	Content        []byte
	Gzipped        bool
}

var (
	MemCached        = map[string]MemFile{}
	slash            = "/"
	fslash           = []byte("/")[0]
	MemFilesFirstRun = true
)

func updateMemfiles() {
	filelist := []string{}
	filepath.Walk(ServerDir, func(location string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {

			servePath := servablePath(location)
			filelist = append(filelist, servePath)

			if !MemFilesFirstRun {
				_, hasFile := MemCached[servePath]
				if !hasFile && DevMode {
					fmt.Println("New File: ", servePath)
				}
			} else if DevMode {
				fmt.Println("New file: ", servePath)
			}

			if mferr := cacheFile(location, servePath); mferr != nil && DevMode {
				panic(mferr)
			}
		}
		return err
	})

	for mfPath, _ := range MemCached {
		shouldDelete := true
		for _, servePath := range filelist {
			if servePath == mfPath {
				shouldDelete = false
			}
		}
		if shouldDelete {
			delete(MemCached, mfPath)
			if DevMode {
				fmt.Println("No longer serving: ", mfPath)
			}
		}
	}
}

func initMemfiles(server *echo.Echo) {
	if Platform == "windows" {
		slash = "\\"
	}
	updateMemfiles()
	MemFilesFirstRun = false

	server.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c ctx) error {
			path := c.Request().URL.Path

			if filepath.Ext(path) == "" {
				if path[len(path)-1] != fslash {
					path = path + "/index.html"
				} else {
					path = path + "index.html"
				}
			}

			if memfile, ok := MemCached[path]; ok {
				serveMemfile(c.Response().Writer, c.Request(), memfile)
				return nil
			}
			return next(c)
		}
	})
}

func cacheFile(location string, servePath string) error {

	apath, err := filepath.Abs(location)
	if err != nil {
		return err
	}

	var data []byte
	data, err = ioutil.ReadFile(apath)
	if err != nil {
		return err
	}

	memfile, exists := MemCached[servePath]
	if exists {
		oldlen := len(memfile.DefaultContent)
		newlen := len(data)
		if newlen == oldlen && string(memfile.DefaultContent) == string(data) {
			return nil
		}
		if DevMode {
			fmt.Println("File Changed: ", servePath)
		}
	}

	memfile.ContentType = http.DetectContentType(data)

	shouldCompress := false

	for _, ext := range Compressable {
		fext := filepath.Ext(location)
		if fext == ext {
			shouldCompress = true
		}
		switch fext {
		case ".css":
			memfile.ContentType = "text/css"
		case ".js":
			memfile.ContentType = "application/javascript"
		}
	}

	memfile.DefaultContent = data
	memfile.Gzipped = shouldCompress
	if shouldCompress {
		memfile.Content = compressBytes(data)
	}

	memfile.ETag = randStr(6)
	MemCached[servePath] = memfile

	return nil
}

func servablePath(loc string) string {
	loc = strings.Replace(loc, ServerDir, "", 1)
	if loc[:1] != slash {
		loc = slash + loc
	}
	if Platform == "windows" {
		loc = strings.Replace(loc, "\\", "/", -1)
	}
	return loc
}

func echoServeMemfile(filename string) func(c ctx) error {
	loc := filename
	if loc[:1] != slash {
		loc = slash + loc
	}
	return func(c ctx) error {
		if memfile, ok := MemCached[loc]; ok {
			serveMemfile(c.Response().Writer, c.Request(), memfile)
			return nil
		}
		return echo.ErrNotFound
	}
}

func serveMemfile(res http.ResponseWriter, req *http.Request, memfile MemFile) {
	res.Header().Set("Etag", memfile.ETag)
	//c.Response().Header().Set("Cache-Control", "public, max-age=3600, must-revalidate")
	//res.Header().Set("Cache-Control", "private, must-revalidate")
	res.Header().Set("Cache-Control", "private, max-age=150, must-revalidate")
	res.Header().Set("Content-Type", memfile.ContentType)
	res.Header().Set("Vary", "Accept-Encoding")

	if match := req.Header.Get("If-None-Match"); match != "" {
		if strings.Contains(match, memfile.ETag) {
			res.WriteHeader(304)
			return
		}
	}

	if match := req.Header.Get("If-Match"); match != "" {
		if strings.Contains(match, memfile.ETag) {
			res.WriteHeader(304)
			return
		}
	}

	if memfile.Gzipped && strings.Contains(req.Header.Get("Accept-Encoding"), "gzip") {
		res.Header().Set("Content-Encoding", "gzip")
		res.WriteHeader(200)
		res.Write(memfile.Content)
	} else {
		res.WriteHeader(200)
		res.Write(memfile.DefaultContent)
	}
}

func serveMemfileCtx(c ctx, memfile MemFile) error {
	headers := c.Response().Header()
	headers.Set("Etag", memfile.ETag)
	headers.Set("Cache-Control", "private, max-age=30, must-revalidate")
	headers.Set("Vary", "Accept-Encoding")

	rHeader := c.Request().Header
	if match := rHeader.Get("If-None-Match"); match != "" {
		if strings.Contains(match, memfile.ETag) {
			return c.NoContent(304)
		}
	}

	if match := rHeader.Get("If-Match"); match != "" {
		if strings.Contains(match, memfile.ETag) {
			return c.NoContent(304)
		}
	}

	if memfile.Gzipped && strings.Contains(rHeader.Get("Accept-Encoding"), "gzip") {
		headers.Set("Content-Encoding", "gzip")
		return c.Blob(200, memfile.ContentType, memfile.Content)
	}
	return c.Blob(200, memfile.ContentType, memfile.DefaultContent)
}
