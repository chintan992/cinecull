import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

IMAGE_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp',
    '.cr2', '.cr3', '.nef', '.arw', '.dng', '.orf', '.rw2', '.pef', '.raf'
}

class PhotoHandler(FileSystemEventHandler):
    def __init__(self, callback):
        super().__init__()
        self.callback = callback

    def on_created(self, event):
        if event.is_directory:
            return
        
        filepath = event.src_path
        ext = os.path.splitext(filepath)[1].lower()
        
        if ext in IMAGE_EXTENSIONS:
            # Wait a short moment to ensure the file copy is finished
            # This is important when copying large RAW files.
            time.sleep(1.0)
            
            # Additional check: verify if file size stops growing
            last_size = -1
            while True:
                try:
                    current_size = os.path.getsize(filepath)
                    if current_size == last_size:
                        break
                    last_size = current_size
                    time.sleep(0.5)
                except OSError:
                    # File might be temporarily locked
                    time.sleep(0.5)
            
            # Fire the callback
            self.callback(filepath)

class PhotoWatcher:
    def __init__(self, watch_dir, callback):
        self.watch_dir = watch_dir
        self.callback = callback
        self.observer = None

    def start(self):
        if not os.path.exists(self.watch_dir):
            os.makedirs(self.watch_dir, exist_ok=True)
            
        event_handler = PhotoHandler(self.callback)
        self.observer = Observer()
        self.observer.schedule(event_handler, self.watch_dir, recursive=False)
        self.observer.start()
        print(f"Watcher started on directory: {self.watch_dir}")

    def stop(self):
        if self.observer:
            self.observer.stop()
            self.observer.join()
            print("Watcher stopped.")
