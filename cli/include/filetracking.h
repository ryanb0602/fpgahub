#include <string>
#include <vector>

#include "./auth.h"
#include "./module_tree_builder.h"

#ifndef FILETRACKING_H
#define FILETRACKING_H

class FileTracker {

public:
  FileTracker(const std::string &trackDir, const std::string &trackFile);
  ~FileTracker();

  struct changeInfo {
    std::string filename;
    std::string change_type; //"new", "modified", "deleted"
    std::string old_hash;
    std::string new_hash;
  };

  std::vector<changeInfo> file_status();

  bool commit(Authenticator &auth, ModuleTreeBuilder &treeBuilder);

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
  std::string generate_tracking();

  std::string init_commit_transaction(Authenticator &auth,
                                      std::string &tracking);
  bool send_modules(Authenticator &auth, std::string &commit_hash);

  ModuleTreeBuilder *builder;
};

#endif // FILETRACKING_H
