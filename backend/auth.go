package grimstack

import (
	"errors"
	"fmt"
	"time"

	valid "github.com/asaskevich/govalidator"
	jwt "github.com/dgrijalva/jwt-go"
)

var (
	ulvlUser  = int64(0)
	ulvlAdmin = int64(1)
)

// vKeyMap - validation key map for passwordless auth
var vKeyMap = map[string]vKey{}

// vKey - validation Key
type vKey struct {
	expire   time.Time
	exists   bool
	username string
	email    string
	key      string
}

func (vk *vKey) Expired() bool {
	if time.Now().Before(vk.expire) {
		return true
	}
	vk.Delete()
	return false
}

func (vk *vKey) Use() bool {
	if time.Now().Before(vk.expire) {
		vk.Delete()
		return true
	}
	vk.Delete()
	return false
}

func (vk *vKey) Delete() {
	delete(vKeyMap, vk.key)
}

func vKeyValid(key string) (vKey, bool) {
	if vk, ok := vKeyMap[key]; ok {
		return vk, vk.Use()
	}
	return vKey{}, false
}

func makevKey(username string, email string, exists bool) string {
	key := randStr(12)
	vKeyMap[key] = vKey{
		expire:   time.Now().Add(time.Minute * 15),
		exists:   exists,
		username: username,
		email:    email,
		key:      key,
	}
	return key
}

func HasExpired(now time.Time, then time.Time) bool {
	return now.Before(then)
}

func updateVKeys() {
	for _, vk := range vKeyMap {
		vk.Expired()
	}
}

type User struct {
	Key         string  `json:"key,omitempty"`
	Username    string  `json:"username,omitempty"`
	Email       string  `json:"email,omitempty"`
	EmailMD5    string  `json:"emailmd5,omitempty"`
	Bio         string  `json:"bio,omitempty"`
	ActiveToken string  `json:"activetoken,omitempty"`
	Level       int64   `json:"level,omitempty"`
	Logins      []int64 `json:"logins,omitempty"`
	Created     int64   `json:"created,omitempty"`
	Exists      bool    `json:"-"`
}

func UserByEmail(email string) (User, bool) {
	data, err := runQuery(`
		FOR user IN users
		FILTER user.email == @email
		RETURN user
	`, obj{
		"email": email,
	})

	if err != nil || len(data) == 0 {
		return User{}, false
	}
	return mapToUser(data[0]), true
}

func UserByUsername(username string) (User, bool) {
	data, err := runQuery(`
		FOR user IN users
		FILTER user.username == @username
		RETURN user
	`, obj{
		"username": username,
	})

	if err != nil || len(data) == 0 {
		return User{}, false
	}
	return mapToUser(data[0]), true
}

func mapToUser(usermap obj) User {
	return User{
		Key:         usermap["_key"].(string),
		Username:    usermap["username"].(string),
		Email:       usermap["email"].(string),
		EmailMD5:    usermap["emailMD5"].(string),
		ActiveToken: usermap["activeToken"].(string),
		Bio:         usermap["bio"].(string),
		Level:       int64(usermap["level"].(float64)),
		Created:     int64(usermap["created"].(float64)),
		Exists:      true,
	}
}

func validUsername(username string) error {
	if valid.Matches(username, `^[a-zA-Z0-9._]{3,55}$`) {
		return nil
	}
	return errors.New(`invalid username`)
}

func validEmail(email string) error {
	if valid.IsEmail(email) {
		return nil
	}
	return errors.New(`invalid email`)
}

func validUsernameAndEmail(username string, email string) error {
	if !isValidEmail(email) {
		return errors.New(`This email address is either fake or broken, please use a valid email that can receive mail`)
	}
	return validUsername(username)
}

func AuthorizeUser(firsttime bool, username string, email string) (User, error) {
	var usr User

	validationErr := validEmail(email)
	if validationErr != nil {
		return usr, validationErr
	}
	validationErr = validUsername(username)
	if validationErr != nil {
		return usr, validationErr
	}

	var userExists bool
	usr, userExists = UserByEmail(email)

	if firsttime {

		if userExists {
			return usr, errors.New(`That email is already on our system, please check that your details are correct`)
		}

		usr, userExists = UserByUsername(username)
		if userExists {
			return usr, errors.New(`That username is already on our system, please check that your details are correct`)
		}

		usr.Email = email
		usr.Username = username
		usr.Level = ulvlUser
		usr.EmailMD5 = GetMD5Hash(usr.Email)
		if usr.Bio == "" || len(usr.Bio) < 5 {
			usr.Bio = "This user has no profile bio..."
		}

		usr.Created = time.Now().Unix()
	}

	token, tkerr := usr.Tokenate()
	if tkerr != nil {
		return usr, tkerr
	}
	usr.ActiveToken = token

	_, err := runQuery(`
		UPSERT {email: @email}
		INSERT {
			username: @username,
			email: @email,
			emailMD5: @emailMD5,
			activeToken: @activeToken,
			bio: @bio,
			level: 0,
			logins: [DATE_NOW()],
			created: DATE_NOW()
		}
		UPDATE {
			activeToken: @activeToken,
			logins: APPEND(OLD.logins, [DATE_NOW()], true)
		} IN users
		`,
		obj{
			"activeToken": usr.ActiveToken,
			"bio":         usr.Bio,
			"emailMD5":    usr.EmailMD5,
			"email":       usr.Email,
			"username":    usr.Username,
		})
	if err != nil {
		if DevMode {
			fmt.Println(err)
		}
		return usr, errors.New("could not create/authorize user, database error")
	}

	usr.Exists = true
	return usr, nil
}

type jwtClaim struct {
	Username string `json:"usr"`
	jwt.StandardClaims
}

func validateToken(tokenStr string, authlevel int64) (User, error) {
	var user User
	var exists bool

	token, err := jwt.ParseWithClaims(tokenStr, &jwtClaim{}, func(token *jwt.Token) (interface{}, error) {
		return JWTKey, nil
	})

	if err != nil {
		return user, err
	}

	if claims, ok := token.Claims.(*jwtClaim); ok && token.Valid {
		username := claims.Username
		user, exists = UserByUsername(username)
		if !exists {
			return user, errors.New("this user does not exist, invalid token")
		}

		if user.ActiveToken != tokenStr {
			return user, errors.New("outdated or fake, invalid token")
		}

		if user.Level < authlevel {
			return user, errors.New("this user is not authorized to use this resource, invalid token")
		}
		return user, nil
	}
	return user, errors.New("invalid token")
}

func (usr *User) Tokenate() (string, error) {
	expiration := time.Now().Add(time.Hour * 72)
	claims := jwtClaim{
		usr.Username,
		jwt.StandardClaims{
			ExpiresAt: expiration.Unix(),
			IssuedAt:  time.Now().Unix(),
			Issuer:    "grimstack.io",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	jwt_tk, err := token.SignedString(JWTKey)
	if err != nil {
		return "", err
	}

	usr.ActiveToken = jwt_tk

	return jwt_tk, nil
}

func (usr *User) Logout() error {
	if usr.Exists {

		_, err := runQuery(`
			FOR user IN users
			FILTER user.email == @email
			UPDATE user WITH {activeToken: ''} IN users
			`, obj{
			"email": usr.Email,
		})

		if err != nil {
			return errors.New("database error could not logout")
		}

	}
	return nil
}

func (usr *User) LikeItem(itemKey string, Collection string) (bool, int, error) {

	data, err := runQuery(`
		FOR item IN `+Collection+`
		FILTER item._key == @key
		LET doesLike = @username IN item.likes
		LET likes = doesLike ? REMOVE_VALUE(item.likes, @username) : PUSH(item.likes, @username)
		LET likeCount = COUNT(likes)
		UPDATE item WITH {likes, likeCount} IN `+Collection+`
		RETURN {
			likeCount,
			doesLike: doesLike ? false : true
		}
	`, obj{
		"key":      itemKey,
		"username": usr.Username,
	})

	if err != nil || len(data) < 1 {
		if DevMode {
			fmt.Println(err)
		}
		return false, 0, err
	}

	likecount := int(data[0]["likeCount"].(float64))
	doesLike := data[0]["doesLike"].(bool)

	return doesLike, likecount, nil
}

func AuthenticateUser(username string, email string) error {

	if err := validUsernameAndEmail(username, email); err != nil {
		return err
	}

	subject := "Login to Grimstack.io"

	user, exists := UserByEmail(email)
	if !exists {
		user.Email = email
		user.Username = username
		subject = "Welcome to Grimstack.io, login for the first time!"
	}
	user.Exists = exists

	validationKey := makevKey(user.Username, user.Email, exists)

	verificationEmail := Email{
		To:      []string{email},
		Subject: subject,
		HTML: []byte(`
		<html>
		<body>
			<style>
				body {
					text-align: center;
					font-family: Roboto, Helvetica, Arial, sans-serif;
					background: #fff;
					color: #fff;
				}
				#content-block {
					width: 92%;
					max-width: 645px;
					margin: 2% auto;
					padding: 2%;
					background: hsl(0,0%,20%);
					border-top: 4px solid #E3DAC9;
					border-radius: 4px;
					box-sizing: border-box;
					box-shadow: 0 1px 6px hsla(0,0%,0%,.2);
				}
				#content-block a {
					color: #fff !important;
					text-decoration: none;
				}
				#v-btn {
					position: relative;
					display: block;
					width: 65px;
					padding: 10px;
					margin: 5px auto;
					border-radius: 3px;
					font-size: 1.2em;
					font-weight: bold;
					color: hsl(0,0%,30%);
					background: #E3DAC9;
					transition: all 140ms ease-in;
				}
				#v-btn:hover {
					box-shadow: 0 1px 6px hsla(0,0%,0%,.2);
				}
			</style>
			<div id="content-block">
	      <p>Hi there ` + user.Username + `, please folow this link to login at grimstack.io</p>
				<a href="https://grimstack.io/auth/` + validationKey + `">
					<div id="v-btn">login</div>
				</a>
	      <p>This login key expires 15 minutes after it was sent and can only be used once</p>
	      <p>
	        If you're using email on a different device then please re-type the validation key into
	        the Authentication form in the Grimstack tab you started.
	        <div><b>` + validationKey + `</b></div>
	      </p>
	    </div>
		</body>
	</html>`),
	}

	return SendEmail(verificationEmail)
}
