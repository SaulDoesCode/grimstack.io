package grimstack

import (
	"context"
	"encoding/json"

	"github.com/solher/arangolite"
	"github.com/solher/arangolite/requests"
)

var (
	DB  *arangolite.Database
	Ctx context.Context
)

func startDBConnection() {
	ctx := context.Background()
	// We declare the database definition.
	db := arangolite.NewDatabase(
		arangolite.OptEndpoint(DBAddress),
		arangolite.OptBasicAuth(DBUser, DBPwd),
		arangolite.OptDatabaseName(DBName),
	)
	critCheck(db.Connect(ctx))
	DB = db
	Ctx = ctx
}

func runQuery(query string, vars obj) ([]obj, error) {
	queryRequest := requests.NewAQL(query)
	for key, val := range vars {
		queryRequest.Bind(key, val)
	}
	nodes := []obj{}
	err := DB.Run(Ctx, &nodes, queryRequest)
	return nodes, err
}

func mapstoJSON(maps []obj) ([]byte, error) {
	data, err := json.Marshal(maps)
	return data, err
}
