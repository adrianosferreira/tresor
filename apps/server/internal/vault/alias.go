package vault

import (
	"errors"
	"regexp"
	"strings"
)

var ErrAliasTaken = errors.New("alias already in use")
var ErrInvalidAlias = errors.New("invalid alias")

const aliasMaxLength = 128

var aliasPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9/_-]*[a-z0-9])?$`)

func normalizeAlias(input string) string {
	return strings.ToLower(strings.TrimSpace(input))
}

func validateAlias(alias string) error {
	if alias == "" {
		return ErrInvalidAlias
	}
	if len(alias) > aliasMaxLength {
		return ErrInvalidAlias
	}
	if !aliasPattern.MatchString(alias) {
		return ErrInvalidAlias
	}
	return nil
}
