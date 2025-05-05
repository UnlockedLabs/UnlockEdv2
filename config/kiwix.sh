#!/bin/bash

set -euo pipefail

S3_BUCKET="" # needs bucket name
INSTANCE_ID="" # needs instance ID
AWS_REGION="us-east-1"

if [ -z "$@" ]; then
  echo "No arguments provided. Please provide a .zim file path or HTTPS URL."
  read -p "Enter .zim file path or HTTPS URL (e.g., https://library.kiwix.org/...): " INPUT
else
  INPUT="$1"
fi

COMMANDS_ARRAY=""
ZIM_FILE_NAME=""

if [[ "$INPUT" =~ ^https?:// ]]; then
  ZIM_FILE_NAME=$(basename "$INPUT")
  if [[ ! "$ZIM_FILE_NAME" =~ \.zim$ ]]; then
    echo "Error: remote file must end in .zim"
    exit 1
  fi

COMMANDS_ARRAY=(
  "set -e"
  "cd /zims"
  "wget -q \"$INPUT\" -O \"$ZIM_FILE_NAME\""
  "/home/admin/.local/bin/kiwix-manage /zims/library.xml add \"/zims/$ZIM_FILE_NAME\""
  "/bin/systemctl restart kiwix.service"
)
else
  if [[ ! -f "$INPUT" ]]; then
	echo "Error: file not found at path: $INPUT"
	exit 1
  fi

  ZIM_FILE_NAME=$(basename "$INPUT")

  if [[ ! "$ZIM_FILE_NAME" =~ \.zim$ ]]; then
	echo "Error: file must end in .zim"
	exit 1
  fi

  echo "Uploading $ZIM_FILE_NAME to s3://$S3_BUCKET/ ..."
  aws s3 cp "$INPUT" "s3://$S3_BUCKET/$ZIM_FILE_NAME" --region "$AWS_REGION"

  COMMANDS_ARRAY=(
	"set -e"
	"aws s3 cp \"s3://$S3_BUCKET/$ZIM_FILE_NAME\" \"/zims/$ZIM_FILE_NAME\" --region \"$AWS_REGION\""
	"/home/admin/.local/bin/kiwix-manage /zims/library.xml add \"/zims/$ZIM_FILE_NAME\""
	"/bin/systemctl restart kiwix.service"
   )
fi

COMMANDS_JSON=$(jq -n --argjson cmds "$(printf '%s\n' "${COMMANDS_ARRAY[@]}" | jq -R . | jq -s .)" '{commands: $cmds}')

echo "Sending SSM command to instance $INSTANCE_ID..."
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --region "$AWS_REGION" \
  --document-name "AWS-RunShellScript" \
  --comment "Install new ZIM file and restart kiwix" \
  --parameters "$COMMANDS_JSON"

echo "Command sent successfully."
