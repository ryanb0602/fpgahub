#include "../include/filetracking.h"
#include "../include/auth.h"
#include "../include/utils.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
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
    std::string stored_time = data_in.substr(0, pos);
    data_in.erase(0, pos + 3);

    pos = data_in.find(":::");
    if (pos == std::string::npos) {
      throw std::runtime_error("Corrupted tracking data");
    }
    std::string hash = data_in.substr(0, pos);
    data_in.erase(0, pos + 3);

    TrackedFile tf{filename, stored_time, hash};
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

bool FileTracker::commit(Authenticator &auth, ModuleTreeBuilder &treeBuilder) {

  std::vector<FileTracker::changeInfo> changes = file_status();

  this->builder = &treeBuilder;

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
      TrackedFile new_tf{change.filename, "placeholder_time", new_hash};
      this->tracked_files.push_back(new_tf);
    }
  }

  int file_n = 0;

  std::string tracking = generate_tracking();

  std::string trans_id = init_commit_transaction(auth, tracking);

  if (trans_id.empty()) {
    std::cerr << "Failed to commit changes to remote server.\n";
    return false;
  }

  // module send
  std::vector<std::string> needed_files = this->send_modules(auth, trans_id);
  // file send

  if (needed_files.empty()) {
    std::cout << "No diff or error during module send." << std::endl;
  }

  this->send_files(auth, trans_id, needed_files);
  // save tracking this side

  return true;
}

std::string FileTracker::generate_tracking() {
  std::string tracking;
  for (const auto &file : this->tracked_files) {
    tracking +=
        file.filename + ":::" + file.stored_time + ":::" + file.hash + ":::";
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

std::string FileTracker::init_commit_transaction(Authenticator &auth,
                                                 std::string &tracking) {
  httplib::Client cli(API_BASE_URL, API_PORT); // server domain or IP
  // Custom headers
  httplib::Headers headers = {{AUTH_HEADER_KEY, auth.pullAuthToken()}};

  auto res = cli.Post("/ft/commit", headers, tracking.data(), tracking.size(),
                      "application/octet-stream");

  if (res) {
    // std::cout << "Status: " << res->status << "\n";

    std::string id =
        res->body.substr(res->body.find("\"id\":\"") + 6)
            .substr(
                0,
                res->body.substr(res->body.find("\"id\":\"") + 6).find("\""));
    if (res->status == 200) {
      return id;
    } else {
      return "";
    }
  } else {
    // std::cout << "Request failed: " << res.error() << "\n";
    return "";
  }
}

std::vector<std::string> FileTracker::send_modules(Authenticator &auth,
                                                   std::string &commit_hash) {
  this->builder->buildTree();
  std::map<std::string, ModuleTreeBuilder::linkMapEntry> link_map =
      this->builder->getModuleLinks();

  std::map<std::string, std::vector<std::string>> file_hash_to_module_name;

  std::string module_links = "";

  for (const auto &entry : link_map) {
    std::string module_name = entry.first;
    ModuleTreeBuilder::linkMapEntry module_entry = entry.second;
    std::string module_filename = module_entry.filename;

    for (const auto &file : this->tracked_files) {
      if (file.filename == module_filename) {
        if (file_hash_to_module_name.find(file.hash) !=
            file_hash_to_module_name.end()) {
          file_hash_to_module_name[file.hash].push_back(module_name);
        } else {
          file_hash_to_module_name[file.hash] =
              std::vector<std::string>{module_name};
        }
        break;
      }
    }

    module_links += ":::" + module_name + ":::";
    for (const auto &dep : module_entry.depends) {
      module_links += dep + ":::";
    }
  }

  std::string file_links = "";

  for (const auto &file : this->tracked_files) {
    std::string hash = file.hash;
    std::vector<std::string> module_names = file_hash_to_module_name[hash];
    file_links += ":::" + hash + ":::";
    for (const auto &mod_name : module_names) {
      file_links += mod_name + ":::";
    }
  }

  std::string body = file_links + "&&&" + module_links;

  httplib::Client cli(API_BASE_URL, API_PORT); // server domain or IP
  // Custom headers
  httplib::Headers headers = {{AUTH_HEADER_KEY, auth.pullAuthToken()}};

  std::string route = "/ft/commit/module-links/" + commit_hash;

  auto res = cli.Post(route, headers, body.data(), body.size(),
                      "application/octet-stream");
  if (res) {
    if (res->status == 200) {
      std::vector<std::string> needed_files = parse_string_array(res->body);
      return needed_files;
    } else {
      return {};
    }
  } else {
    std::cout << "Request failed: " << res.error() << "\n";
    return {};
  }
  return {};
}

bool FileTracker::send_files(Authenticator &auth, std::string &commit_hash,
                             const std::vector<std::string> &modified_files) {
  int i = 1;
  int total = modified_files.size();
  for (const auto &filename : modified_files) {

    httplib::Client cli(API_BASE_URL, API_PORT); // server domain or IP
    // Custom headers
    httplib::Headers headers = {{AUTH_HEADER_KEY, auth.pullAuthToken()},
                                {"X-Filename", filename}};

    std::ifstream ifs(filename, std::ios::binary);
    std::ostringstream ss;
    ss << ifs.rdbuf();
    std::string file_data = ss.str();

    std::string route = "/ft/commit/file-transfer/" + commit_hash + "/" +
                        std::to_string(i) + "/" + std::to_string(total);

    auto res = cli.Post(route, headers, file_data.data(), file_data.size(),
                        "application/octet-stream");
    if (res) {
      std::cout << "Status: " << res->status << "\n";
      if (res->status == 200 || res->status == 202) {
        std::cout << "Sent file " << i << " of " << total << ": " << filename
                  << std::endl;
      } else {
        std::cerr << "Failed to send file: " << filename << std::endl;
        std::cout << "Server response: " << res->body << std::endl;
        return false;
      }
      i++;
    }
  }
  return true;
}
