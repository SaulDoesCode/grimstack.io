package grimstack

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/tidwall/gjson"
)

var (
	indexHTML = "/index.html"
)

type DataService struct {
	Route     string   `json:"route"`
	NeedsAuth bool     `json:"needsAuth"`
	AuthLevel int64    `json:"authLevel"`
	Query     string   `json:"query"`
	RouteVars []string `json:"routevars"`
	BindVars  []string `json:"bindvars"`
}

func serviceMaker(service DataService) error {

	if service.NeedsAuth {
		Server.POST(service.Route, UserOnlyRoute(service.AuthLevel, func(c ctx, user User, result gjson.Result) error {

			bindvars := obj{
				"email":       user.Email,
				"username":    user.Username,
				"userCreated": user.Created,
			}

			for _, param := range service.RouteVars {
				routevar := c.Param(param)
				if routevar == "" {
					return JSONErr(c, 400, "invalid or missing route/url variables, please fix it and try again")
				}
				bindvars[param] = routevar
			}

			for _, bindvar := range service.BindVars {
				bodyvalue := result.Get(bindvar)
				if !bodyvalue.Exists() {
					return JSONErr(c, 400, "invalid or missing post body value, please fix it and try again")
				}
				bindvars[bindvar] = bodyvalue.Value()
			}

			data, err := runQuery(service.Query, bindvars)
			if err != nil {
				if DevMode {
					return JSONErr(c, 500, err.Error())
				}
				return JSONErr(c, 500, "trouble getting data from database, please see that query details are correct")
			}

			return c.JSON(200, data)
		}))
	} else {
		Server.GET(service.Route, func(c ctx) error {

			bindvars := obj{}

			for _, param := range service.RouteVars {
				routevar := c.Param(param)
				if routevar == "" {
					return JSONErr(c, 400, "invalid or missing route/url variables, please fix it and try again")
				}
				bindvars[param] = routevar
			}

			data, err := runQuery(service.Query, bindvars)
			if err != nil {
				if DevMode {
					return JSONErr(c, 400, err.Error())
				}
				return JSONErr(c, 500, "trouble getting data from database, please see that query details are correct")
			}

			return c.JSON(200, data)
		})
	}

	return nil
}

func initRoutes() {

	Server.GET("/", func(c ctx) (err error) {
		pusher, ok := c.Response().Writer.(http.Pusher)
		if ok {
			if err = pusher.Push("/js/localforage.min.js", nil); err != nil {
				return err
			}
			if err = pusher.Push("/js/rilti.min.js", nil); err != nil {
				return err
			}
			if err = pusher.Push("/js/rilti-model.min.js", nil); err != nil {
				return err
			}
			if err = pusher.Push("/js/rilti-app.min.js", nil); err != nil {
				return err
			}
			if err = pusher.Push("/js/timeago.min.js", nil); err != nil {
				return err
			}
			if err = pusher.Push("/js/site.js", nil); err != nil {
				return err
			}
			if err = pusher.Push("/css/site.css", nil); err != nil {
				return err
			}
		}
		memfile, _ := MemCached[indexHTML]
		serveMemfile(c.Response().Writer, c.Request(), memfile)
		return nil
	})

	Server.POST("/writ", func(c ctx) error {
		body, err := JSONbody(c)
		if err != nil {
			return JSONErr(c, 403, "invalid post body")
		}

		writType := body.Get("writtype").String()
		if writType == "" {
			return JSONErr(c, 400, "/writ - invalid writtype, fix it and try again")
		}

		req := body.Get("req").String()
		if req == "" {
			return JSONErr(c, 400, "/writ - invalid request (description || fullpost), fix it and try again")
		}

		var data []byte

		if req == "desc" || req == "tag" || req == "list" {
			pagenum := body.Get("page")
			if !pagenum.Exists() {
				return JSONErr(c, 400, "/writ - invalid page number")
			}
			page := pagenum.Int()

			if page <= 1 {
				page = 0
			} else {
				page = page * 5
			}

			if req == "desc" {

				data, err = GetWritList(page, writType)
				if err != nil {
					return JSONErr(c, 500, err.Error())
				}

			} else if req == "tag" {

				tag := body.Get("tag").String()
				if tag == "" {
					return JSONErr(c, 400, "/writ - invalid tag, fix it and try again")
				}

				data, err = GetWritsByTag(tag, page, writType)
				if err != nil {
					return JSONErr(c, 404, "/writ - "+tag+" couldn't find any posts with that tag")
				}

			}
		} else if req == "slug" {

			slug := body.Get("slug").String()
			if slug == "" {
				return JSONErr(c, 400, "/writ - invalid slug, fix it and try again")
			}

			alreadySeen := body.Get("alreadySeen").Bool()

			data, err = GetWritBySlug(slug, writType, !alreadySeen)
			if err != nil {
				return JSONErr(c, 404, "/writ - "+slug+" couldn't any posts with that slug")
			}

		}

		return c.JSONBlob(200, data)
	})

	Server.GET("/u/:username", func(c ctx) error {
		username := c.Param("username")
		if validUsername(username) != nil {
			return JSONErr(c, 404, "that's an invalid username, try again")
		}
		user, exists := UserByUsername(username)
		if exists {
			user.ActiveToken = ""
			user.Email = ""
			return c.JSON(200, user)
		}
		return JSONErr(c, 404, "there is no user called "+username+" on our system")
	})

	Server.POST("/auth", func(c ctx) error {
		body, err := JSONbody(c)
		if err != nil {
			return JSONErr(c, 403, "malformed request body, try again with valid json")
		}

		email := body.Get("email").String()
		err = validEmail(email)
		if err != nil {
			return JSONErr(c, 403, err.Error())
		}

		username := body.Get("username").String()
		if username == "" {
			user, exists := UserByEmail(email)
			if !exists {
				return JSONErr(c, 403, "Unauthorized, this user does not exist")
			}
			username = user.Username
		}

		authError := AuthenticateUser(username, email)
		if authError != nil {
			if DevMode {
				fmt.Println("auth err: ", authError)
			}
			return JSONErr(c, 403, authError.Error())
		}

		return c.JSON(200, obj{
			"msg": "awaiting session validation, please check your email",
		})
	})

	Server.GET("/auth/:key", func(c ctx) error {
		key := c.Param("key")
		if key != "" {
			vkey, valid := vKeyValid(key)
			if valid {
				user, err := AuthorizeUser(!vkey.exists, vkey.username, vkey.email)
				if err != nil {
					return JSONErr(c, 403, err.Error())
				}
				//return c.JSON(203, user)
				return c.HTML(203, `
				<html>
					<head>
						<script>
							localStorage.setItem('token', '`+user.ActiveToken+`');
							localStorage.setItem('username', '`+user.Username+`');
							localStorage.setItem('gravatar', '`+user.EmailMD5+`');
							console.log('Authentication Success: ', '`+user.ActiveToken+`');
							setTimeout(() => {
								location.replace('/');
							}, 5);
						</script>
					</head>
				</html>`)
			}
		}
		return JSONErr(c, 403, "Unauthorized: invalid key")
	})

	Server.POST("/auth/logout", UserOnlyRoute(ulvlUser, func(c ctx, user User, body gjson.Result) error {
		if user.Logout() == nil {
			return c.JSON(203, obj{
				"msg": "Success, you're logged out",
			})
		}
		return JSONErr(c, 500, "trouble logging out, might be that user is already logged out")
	}))

	Server.POST("/admin/query", UserOnlyRoute(ulvlAdmin, func(c ctx, user User, body gjson.Result) error {

		query := body.Get("query").String()
		if query == "" {
			return JSONErr(c, 400, "no/bad query provided")
		}
		bindvars := obj{}
		bindvarJSON := body.Get("bindvars")
		if bindvarJSON.Exists() {
			err := json.Unmarshal([]byte(bindvarJSON.String()), &bindvars)
			if err != nil {
				return JSONErr(c, 400, err.Error())
			}
		}

		data, err := runQuery(query, bindvars)
		if err != nil {
			return JSONErr(c, 500, err.Error())
		}

		return c.JSON(200, data)
	}))

	Server.POST("/auth/token/", tokenRoute(ulvlUser))
	Server.POST("/auth/admin-token/", tokenRoute(ulvlAdmin))

	Server.POST("/like", UserOnlyRoute(ulvlUser, func(c ctx, user User, body gjson.Result) error {
		itemKey := body.Get("key").String()
		coll := body.Get("coll").String()
		if itemKey == "" {
			return JSONErr(c, 400, "invalid or nonexistent item key provided")
		}
		if coll == "" {
			return JSONErr(c, 400, "invalid or nonexistent collection name provided")
		}

		state, likecount, err := user.LikeItem(itemKey, coll)

		if err == nil {
			return c.JSON(200, obj{
				"msg":       "Success",
				"state":     state,
				"likecount": likecount,
			})
		}

		return JSONErr(c, 200, "server/database error")
	}))
}

func tokenRoute(authlevel int64) func(c ctx) error {
	return func(c ctx) error {
		body, berr := JSONbody(c)
		if berr != nil {
			return JSONErr(c, 403, "Unauthorized: invalid post body")
		}

		user, err := validateToken(body.Get("token").String(), authlevel)
		if err == nil {
			user.Email = ""
			return c.JSON(203, user)
		}

		return JSONErr(c, 403, "Unauthorized: invalid token")
	}
}

func UserOnlyRoute(authlevel int64, handle func(c ctx, user User, result gjson.Result) error) func(c ctx) error {
	return func(c ctx) error {
		if c.Request().Method != "POST" {
			return JSONErr(c, 405, "This is a POST only route")
		}

		body, berr := JSONbody(c)
		if berr != nil {
			return JSONErr(c, 403, "Unauthorized: invalid request body")
		}

		user, err := validateToken(body.Get("token").String(), authlevel)
		if err == nil {
			return handle(c, user, body)
		}

		return JSONErr(c, 403, "Unauthorized: invalid token")
	}
}
