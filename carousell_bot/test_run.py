import main
import asyncio
import traceback

try:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    main.loop_ref = loop

    target = main.targets_list[0]
    print(f"Target: {target}")
    main.process_target(target)
except Exception as e:
    traceback.print_exc()
