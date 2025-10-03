#include <string>
#include <vector>

#ifndef FILETRACKING_H
#define FILETRACKING_H

class FileTracker {

public:
  FileTracker(const std::string &trackDir, const std::string &trackFile);
  ~FileTracker();

  bool file_status();

private:
  struct TrackedFile {
    std::string filename;
    std::string stored_name;
    std::string stored_time;
    std::string hash;
  };

  std::string directory;
  std::string trackFile;
  std::vector<TrackedFile> tracked_files;

  bool init_tracking();
  bool load_tracking();
  bool save_tracking();
};

#endif // FILETRACKING_H
