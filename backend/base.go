package grimstack

import (
	"path/filepath"
	"runtime"
	"time"

	"github.com/labstack/echo/middleware"
)

var (
	JWTKey     []byte
	DevMode    bool
	DBName     string
	DBAddress  string
	DBUser     string
	DBPwd      string
	HTTPS_Key  string
	HTTPS_Cert string
	HTTP_Port  = ":80"
	HTTPS_Port = ":443"
	LinkHost   = "grimstack.io"
	ServerDir  = "./assets/"
	Platform   = runtime.GOOS
	EmailConf  = struct {
		Address  string
		Server   string
		Port     string
		FromTxt  string
		Email    string
		Password string
	}{}
)

// Init - initialze grimstack.io
func Init() {
	config, readconf_err := ReadJSONFile("./meta/config.json")
	critCheck(readconf_err)

	serverdir, direrr := filepath.Abs(config.Get("server.dir").String())
	critCheck(direrr)
	ServerDir = serverdir

	DevMode = config.Get("devMode").Bool()
	JWTKey = []byte(config.Get("server.jwt").String())
	DBAddress = config.Get("db.address").String()
	DBUser = config.Get("db.username").String()
	DBPwd = config.Get("db.password").String()
	DBName = config.Get("db.db").String()
	EmailConf.Email = config.Get("email.email").String()
	EmailConf.Server = config.Get("email.server").String()
	EmailConf.Port = config.Get("email.port").String()
	EmailConf.Password = config.Get("email.password").String()
	EmailConf.FromTxt = config.Get("email.fromtxt").String()
	EmailConf.Address = EmailConf.Server + ":" + EmailConf.Port

	for _, loc := range config.Get("services").Array() {
		if loc.Exists() {
			service := DataService{}
			critCheck(UnmarshalJSONFile(loc.String(), &service))
			serviceMaker(service)
		}
	}

	interval := time.Second * 55

	if DevMode {
		interval = time.Second * 2

		HTTP_Port = ":" + config.Get("server.dev_http_port").String()
		HTTPS_Port = ":" + config.Get("server.dev_https_port").String()
		HTTPS_Key = config.Get("server.key").String()
		HTTPS_Cert = config.Get("server.cert").String()
		LinkHost = "192.168.10.111"

		Server.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
			Format: "${method}::${status} ${host}${uri}  \tlag=${latency_human}\n",
		}))
	}

	startDBConnection()
	initRoutes()
	startEmailer()
	initMemfiles(Server)

	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			updateMemfiles()
			updateVKeys()
		}
	}()
	startServer()
	// startServer is a long loop so this will only run after it ends
	ticker.Stop()
}
