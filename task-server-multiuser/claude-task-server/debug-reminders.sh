#!/bin/bash

echo "🔍 Debugging Apple Reminders Access"
echo "===================================="
echo ""

echo "1️⃣ Testing if Reminders app is accessible..."
osascript -e 'tell application "Reminders" to get name of lists' 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Success! Reminders is accessible"
else
    echo "❌ Failed to access Reminders"
    echo ""
    echo "Possible solutions:"
    echo "  1. Open System Settings → Privacy & Security → Automation"
    echo "  2. Make sure Terminal (or your terminal app) has access to Reminders"
    echo "  3. Try running: tccutil reset AppleEvents"
    exit 1
fi

echo ""
echo "2️⃣ Getting list of Reminders lists..."
LIST_OUTPUT=$(osascript -e '
tell application "Reminders"
    set output to ""
    repeat with aList in lists
        set output to output & "LIST_START" & linefeed
        set output to output & "ID:" & id of aList & linefeed
        set output to output & "NAME:" & name of aList & linefeed
        set output to output & "LIST_END" & linefeed
    end repeat
    return output
end tell
')

echo "$LIST_OUTPUT"

if [ -z "$LIST_OUTPUT" ]; then
    echo "⚠️  No lists found or empty output"
    echo ""
    echo "Please check:"
    echo "  1. Do you have any lists in the Reminders app?"
    echo "  2. Open Reminders.app and verify you can see lists"
else
    echo "✅ Found lists!"
fi

echo ""
echo "3️⃣ Counting lists..."
LIST_COUNT=$(echo "$LIST_OUTPUT" | grep -c "LIST_START")
echo "Found $LIST_COUNT list(s)"

echo ""
echo "4️⃣ Testing task retrieval..."
FIRST_LIST_ID=$(echo "$LIST_OUTPUT" | grep "^ID:" | head -1 | sed 's/ID://')

if [ -n "$FIRST_LIST_ID" ]; then
    echo "Testing with first list ID: $FIRST_LIST_ID"
    osascript -e "
    tell application \"Reminders\"
        set taskCount to 0
        repeat with aList in lists
            if id of aList is \"$FIRST_LIST_ID\" then
                set taskCount to count of reminders of aList
                exit repeat
            end if
        end repeat
        return taskCount
    end tell
    "
    echo "Tasks found in first list: $?"
else
    echo "⚠️  No list ID found to test with"
fi

echo ""
echo "===================================="
echo "Debug complete!"
