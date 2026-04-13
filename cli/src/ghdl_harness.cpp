#include "../include/ghdl_harness.h"
#include "../include/pugixml.hpp" // Ensure you downloaded PugiXML
#include <iostream>
#include <memory>
#include <stdexcept>
#include <array>
#include <sstream>
#include <filesystem>

namespace fs = std::filesystem;

// Helper to execute system commands and capture output
std::string exec_cmd(const std::string& cmd) {
    std::array<char, 128> buffer;
    std::string result;
    std::unique_ptr<FILE, decltype(&pclose)> pipe(popen(cmd.c_str(), "r"), pclose);
    if (!pipe) {
        throw std::runtime_error("Failed to invoke subprocess!");
    }
    while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {
        result += buffer.data();
    }
    return result;
}

void GhdlHarness::print_module_tree(const std::string& filename, const std::vector<std::string>& options) {
    std::cout << "[ghdl_harness] Preparing VHDL cache for: " << filename << "\n";

    std::string workdir = "./.fpgahub/ghdl_cache";
    
    // 1. Ensure the .fpgahub cache directory exists
    fs::create_directories(workdir);

    // Build the base options string
    std::string opts_str = "";
    for (const auto& opt : options) {
        opts_str += opt + " ";
    }

    // 2. Import dependencies
    // Scans the current directory for VHDL files and builds the internal library
    std::string import_cmd = "ghdl -i --workdir=" + workdir + " " + opts_str + "*.vhd 2>&1";
    std::cout << "[ghdl_harness] Executing: " << import_cmd << "\n";
    exec_cmd(import_cmd);

    // 3. Extract the top-level entity name (e.g., "BNN_top.vhd" -> "BNN_top")
    fs::path filePath(filename);
    std::string entity_name = filePath.stem().string();

    // 4. Make the top level 
    // This analyzes the hierarchy and resolves the "unit not found in library work" errors
    std::string make_cmd = "ghdl -m --workdir=" + workdir + " " + opts_str + entity_name + " 2>&1";
    std::cout << "[ghdl_harness] Executing: " << make_cmd << "\n";
    std::string make_out = exec_cmd(make_cmd);
    
    if (make_out.find("error:") != std::string::npos || make_out.find("ghdl:error:") != std::string::npos) {
        std::cerr << "Compilation Failed. GHDL Output:\n" << make_out << "\n";
        return;
    }

    // 5. Generate the XML AST
    std::string xml_cmd = "ghdl --file-to-xml --workdir=" + workdir + " " + opts_str + filename + " 2>&1";
    std::cout << "[ghdl_harness] Executing: " << xml_cmd << "\n";
    std::string result_output = exec_cmd(xml_cmd);

    if (result_output.find("ghdl:error:") != std::string::npos || 
        result_output.find("error:") != std::string::npos) {
         std::cerr << "AST Extraction Failed. GHDL Output:\n" << result_output << "\n";
         return; 
    }

    std::cout << "Successfully retrieved AST. Length: " << result_output.length() << " bytes\n";
    
    // 6. Parse the XML using PugiXML directly from the captured stdout string
    pugi::xml_document doc;
    pugi::xml_parse_result parse_result = doc.load_string(result_output.c_str());

    if (!parse_result) {
        std::cerr << "[pugixml] XML parsed with errors: " << parse_result.description() << "\n";
        return;
    }

    std::cout << "[ghdl_harness] AST successfully loaded into PugiXML.\n";

    // 7. Example Traversal: Extract and print the names of all design units
    // GHDL xml puts modules inside <source_file> -> <design_unit>
    pugi::xml_node source_file = doc.child("source_file");
    if (source_file) {
        for (pugi::xml_node node : source_file.children("design_unit")) {
            pugi::xml_attribute name_attr = node.attribute("name");
            if (name_attr) {
                std::cout << " -> Found design unit: " << name_attr.value() << "\n";
            }
        }
    }
}
