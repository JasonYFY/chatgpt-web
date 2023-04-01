echo "" > front.log
nohup pnpm serve --port 4173 > front.log &
echo "Start front complete!"
