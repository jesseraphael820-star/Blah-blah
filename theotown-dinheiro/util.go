package main

import "strings"

func contains(s, sub string) bool  { return strings.Contains(s, sub) }
func hasPrefix(s, pre string) bool { return strings.HasPrefix(s, pre) }
