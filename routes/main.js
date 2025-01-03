// Create a new router
const express = require("express");
const router = express.Router();

// Define data
var siteName = {siteName: "eduCat"};

// Handle the main routes
router.get('/', (req, res) => {
    res.render("index.ejs", siteName)
}); 

router.get('/about', (req, res) => {
    let sqlquery = "SELECT * FROM modules"; // query database to get all the modules
    // Execute sql query
    db.query(sqlquery, (err, result) => {
        if (err) {
            res.redirect('./'); 
        }
        let newData = Object.assign({}, siteName, {availableModules:result});
        console.log(newData)
        res.render("about.ejs", newData)
        
    });
}); 

router.get('/search', (req, res) => {
    // Query for module names
    const moduleQuery = 'SELECT module_name FROM modules';

    // Query for unique difficulty levels
    const difficultyQuery = 'SELECT DISTINCT difficulty FROM questions';

    // Execute both queries and render the form
    db.query(moduleQuery, (err, modules) => {
        if (err) throw err;

        db.query(difficultyQuery, (err, difficulties) => {
            if (err) throw err;

            let newData = Object.assign({}, siteName, { modules, difficulties });
            res.render("search", newData); // Pass siteName, modules, and difficulties to the search template
        });
    });
});


router.get('/search-results', (req, res) => {
    const { module_name, difficulty } = req.query;

    // Query to get questions based on the selected module and difficulty
    const query = `
        SELECT q.question_id, q.question_text
        FROM questions q
        JOIN modules m ON q.module_id = m.module_id
        WHERE m.module_name = ? AND q.difficulty = ?
    `;
    const values = [module_name, difficulty];

    db.query(query, values, (err, results) => {
        if (err) throw err;

        let newData = Object.assign({}, siteName, {
            questions: results,
            module_name,
            difficulty,
        });
        res.render("search-results", newData); // Pass siteName, questions, module_name, and difficulty to the search-results template
    });
});

router.get('/question/:id', (req, res) => {
    const questionId = req.params.id;

    // Fetch the question with module_id
    const questionQuery = `
        SELECT question_id, module_id, question_text, question_type, difficulty 
        FROM questions 
        WHERE question_id = ?
    `;

    // Fetch answers for the question
    const answerQuery = `
        SELECT answer_id, answer_text, is_correct
        FROM answers 
        WHERE question_id = ?
    `;

    db.query(questionQuery, [questionId], (err, questionResult) => {
        if (err) {
            console.error('Question query error:', err);
            return res.status(500).send("Database error");
        }

        if (!questionResult.length) {
            return res.status(404).send("Question not found");
        }

        const question = questionResult[0];

        db.query(answerQuery, [questionId], (err, answerResults) => {
            if (err) {
                console.error('Answers query error:', err);
                return res.status(500).send("Database error");
            }

            console.log('Question:', question);
            console.log('Answers:', answerResults);

            const newData = Object.assign({}, siteName, {
                question,
                answers: answerResults,
            });

            res.render("question-page", newData);
        });
    });
});

router.post('/check-answer', (req, res) => {
    console.log('Received request body:', req.body);

    const { question_id, question_type, module_id } = req.body;

    console.log('Multiple Choice - Answer ID:', req.body.answer_id);
    console.log('Single Choice - Answer:', req.body.answer);

    let checkAnswerQuery, values;

    if (question_type === 'multiple_choice') {
        // For multiple choice, check by answer_id
        const answer_id = req.body.answer_id;
        console.log('Multiple Choice - Answer ID:', answer_id);
        checkAnswerQuery = `
            SELECT is_correct 
            FROM answers 
            WHERE answer_id = ? AND question_id = ?
        `;
        values = [answer_id, question_id];
    } else if (question_type === 'single_choice') {
        // For single choice, check by exact answer_text
        const answer = req.body.answer;
        console.log('Single Choice - Answer:', answer);
        checkAnswerQuery = `
            SELECT is_correct 
            FROM answers 
            WHERE answer_text = ? AND question_id = ?
        `;
        values = [answer, question_id];
    } else {
        console.error('Invalid question type');
        return res.status(400).send("Invalid question type");
    }

    console.log('Query:', checkAnswerQuery);
    console.log('Values:', values);

    db.query(checkAnswerQuery, values, (err, result) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).send("Database error");
        }

        console.log('Query result:', result);

        if (result.length > 0 && result[0].is_correct) {
            // Correct answer - find next question in the same module
            const nextQuestionQuery = `
                SELECT question_id 
                FROM questions 
                WHERE module_id = ? AND question_id > ? 
                ORDER BY question_id ASC 
                LIMIT 1
            `;

            db.query(nextQuestionQuery, [module_id, question_id], (err, nextQuestion) => {
                if (err) {
                    console.error('Next question query error:', err);
                    return res.status(500).send("Database error");
                }

                const nextQuestionId = nextQuestion.length > 0 ? nextQuestion[0].question_id : null;

                console.log('Rendering correct-answer, next question:', nextQuestionId);
                res.render('correct-answer', {
                    siteName,
                    nextQuestionId,
                    module_id, // Pass module_id to the template
                });
            });
        } else {
            // Incorrect answer
            console.log('Rendering incorrect-answer for question:', question_id);
            res.render('incorrect-answer', {
                siteName,
                question_id,
            });
        }
    });
});

router.get('/module/:id', (req, res) => {
    const moduleId = req.params.id;
    
    // Query to get module details
    const moduleQuery = "SELECT * FROM modules WHERE module_id = ?";
    
    // Query to get all questions for this module
    const questionsQuery = `
        SELECT question_id, question_text, difficulty 
        FROM questions 
        WHERE module_id = ? 
        ORDER BY difficulty, question_id
    `;
    
    // Execute module query first
    db.query(moduleQuery, [moduleId], (err, moduleResult) => {
        if (err) {
            console.error('Module query error:', err);
            res.redirect('./');
            return;
        }
        
        if (!moduleResult.length) {
            res.status(404).send("Module not found");
            return;
        }
        
        // Then execute questions query
        db.query(questionsQuery, [moduleId], (err, questionsResult) => {
            if (err) {
                console.error('Questions query error:', err);
                res.redirect('./');
                return;
            }
            
            // Combine all data
            let newData = Object.assign({}, siteName, {
                module: moduleResult[0],
                questions: questionsResult
            });
            
            res.render("module-questions.ejs", newData);
        });
    });
});

// Gauntlet entry page
router.get('/gauntlet', (req, res) => {
    res.render('gauntlet.ejs', siteName);
});

// Handle username submission and start gauntlet
router.post('/start-gauntlet', (req, res) => {
    const username = req.body.username;
    
    // Insert username into users table
    const insertQuery = "INSERT INTO users (username) VALUES (?)";
    db.query(insertQuery, [username], (err, result) => {
        if (err) {
            console.error('Error inserting user:', err);
            res.redirect('/gauntlet');
            return;
        }
        
        // Get the first question (lowest question_id)
        const questionQuery = `
            SELECT question_id, question_text, question_type, difficulty
            FROM questions
            ORDER BY question_id ASC
            LIMIT 1
        `;
        
        db.query(questionQuery, (err, questions) => {
            if (err || !questions.length) {
                console.error('Error getting first question:', err);
                res.redirect('/gauntlet');
                return;
            }
            
            // Get answers for the question
            const answerQuery = `
                SELECT answer_id, answer_text
                FROM answers
                WHERE question_id = ?
            `;
            
            db.query(answerQuery, [questions[0].question_id], (err, answers) => {
                if (err) {
                    console.error('Error getting answers:', err);
                    res.redirect('/gauntlet');
                    return;
                }
                
                let newData = Object.assign({}, siteName, {
                    username: username,
                    question: questions[0],
                    answers: answers
                });
                
                res.render('gauntlet-questions.ejs', newData);
            });
        });
    });
});

// Handle gauntlet answer checking
router.post('/check-gauntlet-answer', (req, res) => {
    const { question_id, question_type, username } = req.body;
    
    let checkAnswerQuery, values;
    
    if (question_type === 'multiple_choice') {
        const answer_id = req.body.answer_id;
        checkAnswerQuery = `
            SELECT is_correct 
            FROM answers 
            WHERE answer_id = ? AND question_id = ?
        `;
        values = [answer_id, question_id];
    } else {
        const answer = req.body.answer;
        checkAnswerQuery = `
            SELECT is_correct 
            FROM answers 
            WHERE answer_text = ? AND question_id = ?
        `;
        values = [answer, question_id];
    }
    
    db.query(checkAnswerQuery, values, (err, result) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).send("Database error");
        }
        
        if (result.length > 0 && result[0].is_correct) {
            // Get next question
            const nextQuestionQuery = `
                SELECT question_id, question_text, question_type, difficulty
                FROM questions
                WHERE question_id > ?
                ORDER BY question_id ASC
                LIMIT 1
            `;
            
            db.query(nextQuestionQuery, [question_id], (err, questions) => {
                if (err || !questions.length) {
                    // No more questions - user completed the gauntlet!
                    res.render('gauntlet-complete.ejs', { siteName, username });
                    return;
                }
                
                // Get answers for next question
                const answerQuery = `
                    SELECT answer_id, answer_text
                    FROM answers
                    WHERE question_id = ?
                `;
                
                db.query(answerQuery, [questions[0].question_id], (err, answers) => {
                    if (err) {
                        console.error('Error getting answers:', err);
                        res.redirect('/');
                        return;
                    }
                    
                    let newData = Object.assign({}, siteName, {
                        username: username,
                        question: questions[0],
                        answers: answers
                    });
                    
                    res.render('gauntlet-questions.ejs', newData);
                });
            });
        } else {
            // Wrong answer - game over
            res.render('gauntlet-failed.ejs', { siteName, username, question_id });
        }
    });
});

// Export the router object so index.js can access it
module.exports = router;
