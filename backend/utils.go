package grimstack

import (
	"bytes"
	"compress/gzip"
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/tidwall/gjson"
)

type obj = map[string]interface{}

var (
	Compressable     = []string{"", ".txt", ".htm", ".html", ".css", ".php", ".js", ".json", ".md", ".mdown", ".xml", ".svg", ".go", ".cgi", ".py", ".pl", ".aspx", ".asp"}
	RandomDictionary = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
)

func check(err error) error {
	if err != nil {
		fmt.Println(err)
	}
	return err
}

func critCheck(err error) {
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func stringInSlice(str string, list []string) bool {
	for _, v := range list {
		if v == str {
			return true
		}
	}
	return false
}

func compressBytes(data []byte) []byte {
	var buff bytes.Buffer
	gz, gerr := gzip.NewWriterLevel(&buff, 9)
	check(gerr)
	_, wrerr := gz.Write(data)
	check(wrerr)
	check(gz.Flush())
	check(gz.Close())
	return buff.Bytes()
}

func randBytes(size int) []byte {
	bits := make([]byte, size)
	rand.Read(bits)
	for k, v := range bits {
		bits[k] = RandomDictionary[v%byte(len(RandomDictionary))]
	}
	return bits
}

func randStr(size int) string {
	return string(randBytes(size))
}

func GetMD5Hash(text string) string {
	hasher := md5.New()
	hasher.Write([]byte(text))
	return hex.EncodeToString(hasher.Sum(nil))
}

func MD5Hash(data []byte) string {
	hasher := md5.New()
	hasher.Write(data)
	return hex.EncodeToString(hasher.Sum(nil))
}

func JSONbody(c ctx) (gjson.Result, error) {
	body, err := ioutil.ReadAll(c.Request().Body)
	if err != nil {
		return gjson.Result{}, err
	}
	return gjson.ParseBytes(body), err
}

func JSONErr(c ctx, code int, err string) error {
	return c.JSONBlob(code, []byte(`{"err":"`+err+`"}`))
}

func ReadJSONFile(location string) (gjson.Result, error) {
	var result gjson.Result
	data, err := ioutil.ReadFile(location)
	if err != nil {
		return result, err
	}
	result = gjson.ParseBytes(data)
	return result, nil
}

func UnmarshalJSONFile(location string, marshaled interface{}) error {
	data, err := ioutil.ReadFile(location)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, marshaled)
}
