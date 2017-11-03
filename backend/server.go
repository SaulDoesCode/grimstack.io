package grimstack

import (
    "net/http"
    "fmt"
  	"github.com/labstack/echo"
  	"github.com/labstack/echo/middleware"
    "golang.org/x/crypto/acme/autocert"
)

type ctx = echo.Context

var (
  Server = echo.New()
)

func startServer() {
  Server.Use(middleware.Recover())

  // Redirect http traffic to https
  go http.ListenAndServe(HTTP_Port, http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
    target := "https://" + req.Host + req.URL.Path
    if len(req.URL.RawQuery) > 0 {
      target += "?" + req.URL.RawQuery
    }
    if DevMode {
      fmt.Printf("\nredirect to: %s \n", target)
      fmt.Println(req.RemoteAddr)
    }
    http.Redirect(res, req, target, http.StatusTemporaryRedirect)
  }))

  if !DevMode {
    Server.Logger.Fatal(Server.StartTLS(HTTPS_Port, HTTPS_Cert, HTTPS_Key))
  } else {
    Server.AutoTLSManager.HostPolicy = autocert.HostWhitelist("grimstack.io")
    Server.AutoTLSManager.Cache = autocert.DirCache("./meta/tls")
    Server.Logger.Fatal(Server.StartAutoTLS(HTTPS_Port))
  }
}
