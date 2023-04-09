echo "" > front.log
nohup pnpm serve --port 4173 > front.log 2>&1 &
echo "Start front complete!"
