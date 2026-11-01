//go:build windows

package main

import (
	"flag"
	"os"
	"path/filepath"
	"runtime"

	"calendarhub/internal/desktop"
	"calendarhub/internal/hub"
	"github.com/lxn/walk"
	"golang.org/x/sys/windows"
)

func main() {
	runtime.LockOSThread()
	exe, _ := os.Executable()
	config := flag.String("config", filepath.Join(filepath.Dir(exe), "config.json"), "OAuth application configuration")
	demo := flag.Bool("demo", false, "Sample calendars without login")
	flag.Parse()
	name, _ := windows.UTF16PtrFromString("Local\\CalendarHubNative.v1")
	lock, e := windows.CreateMutex(nil, false, name)
	if e == windows.ERROR_ALREADY_EXISTS {
		walk.MsgBox(nil, "Calendar Hub", "Calendar Hub Native가 이미 실행 중입니다.", walk.MsgBoxIconInformation)
		return
	}
	if e != nil {
		walk.MsgBox(nil, "실행 오류", e.Error(), walk.MsgBoxIconError)
		return
	}
	defer windows.CloseHandle(lock)
	service, e := hub.New(*config, *demo)
	if e == nil {
		e = desktop.Run(service)
	}
	if e != nil {
		walk.MsgBox(nil, "Calendar Hub 실행 오류", e.Error(), walk.MsgBoxIconError)
	}
}
