@echo off
rem
rem Build Haroopad's Windows binaries into dist\, and optionally install them.
rem
rem   build.bat            build the Windows .exe files
rem   build.bat install    build, then install per-user (silent, no admin rights)
rem   build.bat smoke      build if needed, then run the smoke test on the result
rem   build.bat clean      remove dist\ first, then build
rem
rem Produces in dist\:
rem   Haroopad Setup <version>.exe   installer (NSIS, per-user)
rem   Haroopad <version>.exe         portable executable, needs no install
rem   win-unpacked\                  the same build as a plain directory
rem
rem "install" puts Haroopad in %LOCALAPPDATA%\Programs\Haroopad and adds Desktop
rem and Start Menu shortcuts, an Add/Remove Programs entry, and the Markdown file
rem associations. Uninstall it from Add/Remove Programs.
rem
rem Requires Node.js (and npm) on PATH. Nothing else: no Wine, no Docker, no
rem Visual Studio. build.sh is the Linux equivalent of this script.
rem

setlocal EnableExtensions
cd /d "%~dp0"

set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=build"
if "%TARGET%"=="/?" goto :usage
if /i "%TARGET%"=="-h" goto :usage
if /i "%TARGET%"=="--help" goto :usage
if /i "%TARGET%"=="help" goto :usage

if /i "%TARGET%"=="clean" (
  echo.
  echo ==^> Removing dist\
  if exist "dist" rmdir /s /q "dist"
  set "TARGET=build"
)

if /i "%TARGET%"=="build"   goto :checked
if /i "%TARGET%"=="install" goto :checked
if /i "%TARGET%"=="smoke"   goto :checked
echo error: unknown target "%TARGET%" 1>&2
goto :usage

:checked
where node >nul 2>nul
if errorlevel 1 (
  echo error: Node.js is not on PATH ^(get it from https://nodejs.org^) 1>&2
  goto :fail
)

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "VERSION=%%v"
if not defined VERSION (
  echo error: could not read the version out of package.json 1>&2
  goto :fail
)

set "SETUP=dist\Haroopad Setup %VERSION%.exe"
set "UNPACKED=dist\win-unpacked\Haroopad.exe"

call :ensure_deps
if errorlevel 1 goto :fail

rem smoke reuses an existing build; build and install always build fresh.
if /i "%TARGET%"=="smoke" if exist "%UNPACKED%" goto :dispatch

call :build
if errorlevel 1 goto :fail

:dispatch
if /i "%TARGET%"=="install" goto :do_install
if /i "%TARGET%"=="smoke"   goto :do_smoke
goto :done

:do_install
call :install
if errorlevel 1 goto :fail
goto :done

:do_smoke
call :smoke
if errorlevel 1 goto :fail
goto :done

:done
call :summary
echo.
echo ==^> Haroopad %VERSION%: %TARGET% complete
exit /b 0


rem ---------------------------------------------------------------- routines

:ensure_deps
if exist "node_modules" goto :eof
echo.
echo ==^> Installing dependencies
call npm install
if errorlevel 1 exit /b 1
goto :eof

:build
echo.
echo ==^> Building Windows targets ^(NSIS installer, portable^)
call npx electron-builder --win --publish never
if errorlevel 1 (
  echo.
  echo     If this says "Can't open output file", a running Haroopad is holding
  echo     dist\Haroopad ^<version^>.exe open. Close it and build again.
  exit /b 1
)

rem A page can reference a file that the packaging globs quietly dropped; the
rem app still starts, so only the missing feature gives it away.
echo.
echo ==^> Checking every referenced file survived packaging
call node scripts\check-packaged-assets.js
if errorlevel 1 exit /b 1
goto :eof

:install
if not exist "%SETUP%" (
  echo error: "%SETUP%" not found 1>&2
  exit /b 1
)
echo.
echo ==^> Installing into %%LOCALAPPDATA%%\Programs\Haroopad
rem /S is the NSIS silent switch; start /wait blocks until the installer is done.
start "" /wait "%SETUP%" /S
set "RC=%errorlevel%"
if not "%RC%"=="0" (
  echo error: the installer failed ^(exit %RC%^) 1>&2
  exit /b 1
)
echo     done - launch Haroopad from the Start Menu or the Desktop shortcut
goto :eof

:smoke
echo.
echo ==^> Smoke-testing the packaged build
echo     Windows GUI executables have no console, so the test prints nothing
echo     here; the exit code is the result and the report is written to a file.
set "HAROOPAD_SMOKE=1"
set "HAROOPAD_SMOKE_TIMEOUT=90000"
set "HAROOPAD_SMOKE_OUT=%TEMP%\haroopad-smoke.txt"
rem Some parent processes export ELECTRON_RUN_AS_NODE. With it set, the app
rem starts as plain Node, does nothing and exits 0 -- a test that always passes.
set "ELECTRON_RUN_AS_NODE="
if exist "%HAROOPAD_SMOKE_OUT%" del /q "%HAROOPAD_SMOKE_OUT%"
start "" /wait "%UNPACKED%"
set "RC=%errorlevel%"
set "HAROOPAD_SMOKE="
set "HAROOPAD_SMOKE_TIMEOUT="
if not "%RC%"=="0" (
  echo error: smoke test failed ^(exit %RC%^) 1>&2
  echo     report: %HAROOPAD_SMOKE_OUT% 1>&2
  exit /b 1
)
if not exist "%HAROOPAD_SMOKE_OUT%" (
  echo error: the app exited 0 without writing a report; it did not run the test 1>&2
  exit /b 1
)
echo     smoke test passed ^(report: %HAROOPAD_SMOKE_OUT%^)
goto :eof

:summary
echo.
echo ==^> Artifacts in dist\
if not exist "dist" goto :eof
for %%f in ("dist\*.exe") do echo     %%~nxf  ^(%%~zf bytes^)
goto :eof

:usage
echo.
echo Usage: build.bat [build^|install^|smoke^|clean]
echo.
echo   build      build the Windows installer and portable .exe into dist\
echo   install    build, then install per-user with no prompts
echo   smoke      build if needed, then run the app's self-test against it
echo   clean      delete dist\ first, then build
echo.
exit /b 2

:fail
echo.
echo build.bat failed 1>&2
exit /b 1
