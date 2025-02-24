@echo off 
echo KinKong Tasks Status Check 
echo ======================== 
schtasks /query /tn "KinKong_*" 
pause 
