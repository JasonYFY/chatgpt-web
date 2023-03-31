echo "" > front.log
nohup pnpm serve > front.log &
echo "Start front complete!"
tail -f front.log
