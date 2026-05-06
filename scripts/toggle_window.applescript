#!/usr/bin/env osascript
-- Toggle Cairn window visibility

tell application "Cairn"
    activate
    if visible then
        tell application "System Events" to tell process "cairn"
            try
                if value of attribute "AXMinimized" of window 1 then
                    set value of attribute "AXMinimized" of window 1 to false
                else
                    set visible to false
                end if
            end try
        end tell
    else
        set visible to true
    end if
end tell
