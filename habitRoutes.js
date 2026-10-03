const express = require('express');
const { readHabits, writeHabits } = require('../utils/store');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

function getUserHabits(userId) {
  return readHabits().filter((habit) => String(habit.userId) === String(userId));
}

router.get('/', (req, res) => {
  const habits = getUserHabits(req.user.id);
  return res.status(200).json({ habits });
});

router.post('/', (req, res) => {
  try {
    const { name, category, icon, days, completions } = req.body || {};

    if (!name || !Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ message: 'Habit name and at least one day are required.' });
    }

    const habits = readHabits();
    const newHabit = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      userId: req.user.id,
      name: String(name).trim(),
      category: category || 'personal',
      icon: icon || '✓',
      days: days.map((day) => Number(day)),
      completions: completions || {},
    };

    habits.push(newHabit);
    writeHabits(habits);

    return res.status(201).json({ message: 'Habit created successfully.', habit: newHabit });
  } catch (error) {
    return res.status(500).json({ message: 'Habit creation failed.', error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, icon, days, completions } = req.body || {};
    const habits = readHabits();

    const index = habits.findIndex(
      (habit) => String(habit.id) === String(id) && String(habit.userId) === String(req.user.id)
    );

    if (index === -1) {
      return res.status(404).json({ message: 'Habit not found.' });
    }

    habits[index] = {
      ...habits[index],
      name: String(name || habits[index].name).trim(),
      category: category || habits[index].category,
      icon: icon || habits[index].icon,
      days: Array.isArray(days) && days.length ? days.map((day) => Number(day)) : habits[index].days,
      completions: completions || habits[index].completions || {},
    };

    writeHabits(habits);

    return res.status(200).json({ message: 'Habit updated successfully.', habit: habits[index] });
  } catch (error) {
    return res.status(500).json({ message: 'Habit update failed.', error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const habits = readHabits();
    const filtered = habits.filter(
      (habit) => !(String(habit.id) === String(id) && String(habit.userId) === String(req.user.id))
    );

    if (filtered.length === habits.length) {
      return res.status(404).json({ message: 'Habit not found.' });
    }

    writeHabits(filtered);
    return res.status(200).json({ message: 'Habit deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Habit deletion failed.', error: error.message });
  }
});

router.post('/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body || {};
    const habits = readHabits();

    const habitIndex = habits.findIndex(
      (habit) => String(habit.id) === String(id) && String(habit.userId) === String(req.user.id)
    );

    if (habitIndex === -1) {
      return res.status(404).json({ message: 'Habit not found.' });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const habit = habits[habitIndex];
    habit.completions = habit.completions || {};
    habit.completions[targetDate] = !Boolean(habit.completions[targetDate]);

    writeHabits(habits);
    return res.status(200).json({ message: 'Habit updated successfully.', habit });
  } catch (error) {
    return res.status(500).json({ message: 'Habit toggle failed.', error: error.message });
  }
});

module.exports = router;