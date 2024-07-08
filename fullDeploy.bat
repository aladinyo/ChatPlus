call npm run build
call firebase deploy --only hosting
call node ./backend/Test
git add .
git commit -m "%*"
call git push origin main