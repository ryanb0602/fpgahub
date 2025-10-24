#include "../include/filetracking.h"
#include "../include/auth.h"
#include "../include/utils.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

FileTracker::FileTracker(const ::std::string &trackDir,
                         const std::string &trackFile) {
  this->directory = trackDir;
  this->trackFile = trackFile;

  std::string fullPath = directory + "/" + trackFile;

  if (std::filesystem::exists(fullPath)) {
    // Load existing tracking data
    load_tracking();
  } else {
    init_tracking();
  }
}

FileTracker::~FileTracker() {
  // save_tracking();
}

bool FileTracker::init_tracking() {
  std::string fullPath = directory + "/" + trackFile;

  std::filesystem::create_directories(directory);

  std::ofstream ofs(fullPath.c_str());

  if (!ofs) {
    throw std::runtime_error("Failed to create tracking file: " + fullPath);
    return false;
  }

  ofs.close();

  return true;
}

bool FileTracker::load_tracking() {
  std::string fullPath = directory + "/" + trackFile;

  std::ifstream ifs(fullPath.c_str());
  if (!ifs) {
    throw std::runtime_error("Failed to open tracking file: " + fullPath);
    return false;
  }

  std::string data_in;
  std::getline(ifs, data_in);
  ifs.close();
  if (data_in.empty()) {
    return true; // No data to load
  }

  while (!data_in.empty()) {
    size_t pos = data_in.find(":::");
    if (pos == std::string::npos) {
      break;
    }
    std::string filename = data_in.substr(0, pos);
    data_in.erase(0, pos + 3);

    pos = data_in.find(":::");
    if (pos == std::string::npos) {
      throw std::runtime_error("Corrupted tracking data");
    }
    std::string stored_name = data_in.substr(0, pos);
    data_in.erase(0, pos + 3);

    pos = data_in.find(":::");
    if (pos == std::string::npos) {
      throw std::runtime_error("Corrupted tracking data");
    }
    std::string stored_time = data_in.substr(0, pos);
    data_in.erase(0, pos + 3);

    pos = data_in.find(":::");
    if (pos == std::string::npos) {
      throw std::runtime_error("Corrupted tracking data");
    }
    std::string hash = data_in.substr(0, pos);
    data_in.erase(0, pos + 3);

    TrackedFile tf{filename, stored_name, stored_time, hash};
    tracked_files.push_back(tf);
  }

  return true;
}

std::vector<FileTracker::changeInfo> FileTracker::file_status() {
  std::vector<FileTracker::changeInfo> changes;

  std::string directory = "./";

  std::vector<std::string> current_files = list_files_recursive(directory);

  for (const auto &file : this->tracked_files) {
    if (std::find(current_files.begin(), current_files.end(), file.filename) ==
        current_files.end()) {
      changes.push_back({file.filename, "deleted"});
    } else {
      // compute hash, compare
      std::string current_hash = hashFile(file.filename);

      if (current_hash != file.hash) {
        changes.push_back({file.filename, "modified", file.hash, current_hash});
      }

      current_files.erase(std::remove(current_files.begin(),
                                      current_files.end(), file.filename),
                          current_files.end());
    }
  }

  for (const auto &file : current_files) {
    if (file.find("./.fpgahub") != std::string::npos) {
      continue; // Skip internal tracking file
    }
    changes.push_back({file, "new"});
  }

  return changes;
}

bool FileTracker::commit(Authenticator &auth) {

  std::vector<FileTracker::changeInfo> changes = file_status();

  if (changes.empty()) {
    std::cout << "No changes detected.\n";
    return true;
  }

  this->load_tracking();

  for (const auto &change : changes) {
    if (change.change_type == "deleted") {
      this->tracked_files.erase(
          std::remove_if(this->tracked_files.begin(), this->tracked_files.end(),
                         [&](const TrackedFile &tf) {
                           return tf.filename == change.filename;
                         }),
          this->tracked_files.end());
    } else if (change.change_type == "modified") {
      for (auto &tf : this->tracked_files) {
        if (tf.filename == change.filename) {
          tf.hash = change.new_hash;
          tf.stored_time = "placeholder_time";
          break;
        }
      }
    } else if (change.change_type == "new") {
      std::string new_hash = hashFile(change.filename);
      TrackedFile new_tf{change.filename, change.filename, "placeholder_time",
                         new_hash};
      this->tracked_files.push_back(new_tf);
    }
  }

  int file_n = 0;

  std::string tracking = generate_tracking();

  if (!init_commit_transaction(auth, tracking)) {
    std::cerr << "Failed to commit changes to remote server.\n";
    return false;
  }

  // module send
  // file send
  // save tracking this side

  return true;
}

std::string FileTracker::generate_tracking() {
  std::string tracking;
  for (const auto &file : this->tracked_files) {
    tracking += file.filename + ":::" + file.stored_name +
                ":::" + file.stored_time + ":::" + file.hash + ":::";
  }
  return tracking;
}

bool FileTracker::save_tracking() {
  std::string fullPath = directory + "/" + trackFile;

  if (!std::filesystem::exists(fullPath)) {

    init_tracking();
  }
  std::string tracking = generate_tracking();
  std::ofstream ofs(fullPath.c_str(), std::ios::trunc);
  if (!ofs) {
    throw std::runtime_error("Failed to open tracking file for writing: " +
                             fullPath);
    return false;
  }
  ofs << tracking;
  ofs.close();
  return true;
}

bool FileTracker::init_commit_transaction(Authenticator &auth,
                                          std::string &tracking) {
  httplib::Client cli(API_BASE_URL, API_PORT); // server domain or IP
  // Custom headers
  httplib::Headers headers = {{AUTH_HEADER_KEY, auth.pullAuthToken()}};

  auto res = cli.Post("/ft/commit", headers, tracking.data(), tracking.size(),
                      "application/octet-stream");

  if (res) {
    // std::cout << "Status: " << res->status << "\n";
    // std::cout << "Body: " << res->body << "\n";
    if (res->status == 200) {
      return true;
    } else {
      return false;
    }
  } else {
    // std::cout << "Request failed: " << res.error() << "\n";
    return false;
  }
}
