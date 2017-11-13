package grimstack

//"fmt"
//"github.com/tidwall/gjson"

type Comment struct {
	WritID  string
	Content string
	User    string
	Date    int64
	Edits   []int64
	Likes   []string
}

func CommentOnWrit(username string, writID string, content string) (obj, error) {
	data, err := runQuery(`
    UPSERT { writID: @writID, username: @username, content: @content }
    INSERT {
      writID: @writID,
      username: @username,
      content: @content,
      edits: [],
      likes: [@username],
      date: DATE_NOW(),
      deleted: false
    }
    UPDATE {
      content: @content,
      edits: APPEND(OLD.edits, [DATE_NOW()], true)
    } IN comments
    RETURN NEW
  `, obj{
		"username": username,
		"writID":   writID,
		"content":  content,
	})

	return data[0], err
}

func EditComment(key string, username string, content string) (obj, error) {
	data, err := runQuery(`
    FOR comment IN comments
    FILTER comment._key == @key && comment.username == @username
    UPDATE comment WITH {
      content: @content,
      edits: APPEND(OLD.edits, [DATE_NOW()], true)
    } IN comments
    RETURN NEW
  `, obj{
		"key":      key,
		"username": username,
		"content":  content,
	})

	return data[0], err
}

func RemoveComment(key string, username string) error {
	_, err := runQuery(`
    FOR comment IN comments
    FILTER comment._key == @key && comment.username == @username
    UPDATE comment WITH {deleted: true} IN comments
    RETURN NEW
  `, obj{
		"key":      key,
		"username": username,
	})

	return err
}

func GetWritComments(page int64, writID string) ([]obj, error) {
	return runQuery(`
    FOR comment IN comments
    FILTER comment.writID == @writID && comment.deleted == false
    LIMIT @offset, 10
    RETURN UNSET(comment, "_id", "_rev", "edits", "deleted")
  `, obj{
		"writID": writID,
		"offset": page,
	})
}
