#include "../include/graph_differencing_engine.h"

template <class... Ts> struct overloaded : Ts... {
  using Ts::operator()...;
};
template <class... Ts> overloaded(Ts...) -> overloaded<Ts...>;

std::vector<graph_differencing_engine::moduleEditType>
graph_differencing_engine::FPGAHub_gumtree::actionGenerator() {

  std::vector<moduleEditType> possible_edits;

  // find possible, unordered edit actions from the mappings
  // this is technically inefficient, loops over mapping list four times, but
  // more readable
  possible_edits.append_range(this->extractEditActions());
  possible_edits.append_range(this->extractMoveActions());
  this->populate_unmapped();
  possible_edits.append_range(this->extractAddActions());
  possible_edits.append_range(this->extractDeleteActions());

  std::cout << "\n--- Generated Edit Script ---\n";
  for (const auto &edit : possible_edits) {
    std::visit(overloaded{[&](const updateModule &e) {
                            std::cout << "UPDATE: " << e.name << "\n";
                          },
                          [&](const addModule &e) {
                            std::cout << "ADD: " << e.new_module.name
                                      << " to parent " << e.parent.name << "\n";
                          },
                          [&](const deleteModule &e) {
                            std::cout << "DELETE: " << e.module_rem.name
                                      << "\n";
                          },
                          [&](const moveModule &e) {
                            std::cout << "MOVE: " << e.module_move.name
                                      << " to new parent " << e.new_parent.name
                                      << "\n";
                          }},
               edit);
  }
  std::cout << "-----------------------------\n";

  // placeholder
  return std::vector<graph_differencing_engine::moduleEditType>();
}

std::vector<graph_differencing_engine::updateModule>
graph_differencing_engine::FPGAHub_gumtree::extractEditActions() {

  std::vector<updateModule> edits;

  for (const auto &[key, value] : this->M) {
    if (key->hash != value->hash) {
      // found change and need to create edit action for it
      updateModule new_action = {value->name, value->getModuleBody()};
      edits.push_back(new_action);
    }
  }

  return edits;
}

std::vector<graph_differencing_engine::moveModule>
graph_differencing_engine::FPGAHub_gumtree::extractMoveActions() {

  std::vector<moveModule> moves;

  for (const auto &[key, value] : this->M) {
    // check if key or value is a root
    if (this->sg_parent_map.find(key->id) == this->sg_parent_map.end())
      continue;

    if (this->dg_parent_map.find(value->id) == this->dg_parent_map.end())
      continue;

    graph::module *m1_parent = this->sg_parent_map[key->id];
    graph::module *m2_parent = this->dg_parent_map[value->id];

    // if different parents, make move
    if (m1_parent->name != m2_parent->name) {

      moveModule new_move = {*value, *m2_parent};
      moves.push_back(new_move);
    }
  }

  return moves;
}

void graph_differencing_engine::FPGAHub_gumtree::populate_unmapped() {

  std::vector<graph::module *> sg_modules = this->source_graph->modules;
  std::vector<graph::module *> dg_modules = this->destination_graph->modules;

  for (const auto &[key, value] : this->M) {

    std::erase(sg_modules, key);
    std::erase(dg_modules, value);
  }
  this->sg_unmapped = sg_modules;
  this->dg_unmapped = dg_modules;
}

std::vector<graph_differencing_engine::addModule>
graph_differencing_engine::FPGAHub_gumtree::extractAddActions() {

  std::vector<addModule> adds;

  for (graph::module *m : this->dg_unmapped) {

    addModule add = {*m, *this->dg_parent_map[m->id]};
    adds.push_back(add);
  }

  return adds;
}

std::vector<graph_differencing_engine::deleteModule>
graph_differencing_engine::FPGAHub_gumtree::extractDeleteActions() {

  std::vector<deleteModule> deletes;

  for (graph::module *m : this->sg_unmapped) {

    deleteModule deleted = {*m};
    deletes.push_back(deleted);
  }

  return deletes;
}
