#!/bin/bash

TYPE=$1
NAME=$2
LINK=$3
LANG=$4
TAG=$5
git pull
count=`grep "$LINK" mirror-original.csv | wc -l`
if [[ $TYPE -eq 1 && $count -eq 0 ]]
then
    echo "$NAME, https://mirror.xyz/$LINK, https://submirror.xyz/$LINK, $TAG" >> mirror-original.csv
    echo "$NAME, https://mirror.xyz/$LINK, https://submirror.xyz/$LINK, $LANG, $TAG" >> mirror-original-langs.csv
elif [[ $TYPE -eq 2 && $count -eq 0 ]]
then
    echo "$NAME, https://$LINK.mirror.xyz/, https://$LINK.submirror.xyz/, $TAG" >> mirror-original.csv
    echo "$NAME, https://$LINK.mirror.xyz/, https://$LINK.submirror.xyz/, $LANG, $TAG" >> mirror-original-langs.csv
elif [[ $count -eq 1 ]]
then
    echo "$LINK is exists."
else
    echo "Nothing."
fi

bash git_push.sh "Add $NAME"